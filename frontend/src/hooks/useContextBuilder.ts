/**
 * Hook for building intelligent context from parent nodes
 * 
 * Handles:
 * - Multi-parent aggregation
 * - Model-specific token limits
 * - Smart truncation when context exceeds limits
 * - Sorting by depth and importance
 */

import { useMemo } from 'react';
import type { Node, Graph, UUID } from '../types/graph';
import { getModelContextLimit } from '../constants/modelLimits';

interface LLMWorkflowSettings {
    model: string;
    max_tokens: number;
    temperature: number;
    system_prompt: string;
    include_parent_context: boolean;
}

interface ContextBuildResult {
    finalPrompt: string;
    contextTokens: number;
    maxTokens: number;
    includedParents: number;
    truncatedParents: number;
}

/**
 * Estimate token count (approximation: 1 token ≈ 4 chars)
 */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Get parent nodes for a given node
 */
function getParentNodes(graph: Graph, node: Node): Node[] {
    return node.parents
        .map(parentId => graph.nodes[parentId])
        .filter(Boolean);
}

/**
 * Calculate node depth (root = 0, children = parent depth + 1)
 */
function getNodeDepth(graph: Graph, node: Node): number {
    if (node.parents.length === 0) return 0;
    const parentDepths = node.parents
        .map(parentId => graph.nodes[parentId])
        .filter(Boolean)
        .map(parent => getNodeDepth(graph, parent));
    return Math.max(...parentDepths, 0) + 1;
}

/**
 * Build intelligent context from parent nodes
 */
export function useContextBuilder(
    graph: Graph | null,
    node: Node | null,
    settings: LLMWorkflowSettings
): ContextBuildResult {
    return useMemo(() => {
        if (!graph || !node) {
            return {
                finalPrompt: node?.content || '',
                contextTokens: 0,
                maxTokens: 0,
                includedParents: 0,
                truncatedParents: 0,
            };
        }

        const maxTokens = getModelContextLimit(settings.model);
        const reservedForPrompt = 500; // Reserve tokens for user prompt
        const reservedForResponse = settings.max_tokens; // Tokens for response
        const availableForContext = Math.max(0, maxTokens - reservedForPrompt - reservedForResponse);

        let context = '';
        let estimatedTokens = 0;
        let includedParents = 0;
        let truncatedParents = 0;

        if (settings.include_parent_context) {
            const parents = getParentNodes(graph, node);

            // Sort by depth (deeper = more important) then by importance
            const sortedParents = [...parents].sort((a, b) => {
                const depthA = getNodeDepth(graph, a);
                const depthB = getNodeDepth(graph, b);
                if (depthA !== depthB) return depthB - depthA; // Deeper first
                return (b.meta.importance || 0.5) - (a.meta.importance || 0.5);
            });

            // Build context respecting token limits
            for (const parent of sortedParents) {
                const parentContext = `[Parent ${parent.type}]: ${parent.content}\n`;
                const parentTokens = estimateTokens(parentContext);

                // Check if we have room
                if (estimatedTokens + parentTokens > availableForContext) {
                    // Try to truncate
                    const remainingChars = (availableForContext - estimatedTokens) * 4;
                    if (remainingChars > 100) {
                        context += `[Parent ${parent.type}]: ${parent.content.substring(0, remainingChars)}...\n`;
                        estimatedTokens += Math.ceil(remainingChars / 4);
                        includedParents++;
                    }
                    truncatedParents = sortedParents.length - includedParents;
                    break;
                }

                context += parentContext;
                estimatedTokens += parentTokens;
                includedParents++;

                // Include LLM response if available
                if (parent.llm_response) {
                    const responseContext = `[Response]: ${parent.llm_response}\n`;
                    const responseTokens = estimateTokens(responseContext);

                    if (estimatedTokens + responseTokens <= availableForContext) {
                        context += responseContext;
                        estimatedTokens += responseTokens;
                    }
                }

                context += '\n';
            }
        }

        // Build final prompt
        const systemPrompt = settings.system_prompt || 'You are a helpful assistant.';
        const finalPrompt = `${systemPrompt}\n\n${context}[Current]: ${node.content}`;

        return {
            finalPrompt,
            contextTokens: estimatedTokens,
            maxTokens,
            includedParents,
            truncatedParents,
        };
    }, [graph, node, settings]);
}

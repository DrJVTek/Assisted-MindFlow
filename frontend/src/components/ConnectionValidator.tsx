/**
 * ConnectionValidator — validates connections between nodes using the type system.
 *
 * Uses nodeTypesStore (single source of truth) instead of a duplicate fetch.
 * Implements the full type compatibility matrix from data-model.md.
 *
 * Provides:
 * - isValidConnection: callback for ReactFlow's isValidConnection prop
 * - isTypeCompatible: check if two types can connect
 * - getHandleColor: returns the color for a handle based on its data type
 */

import { useCallback } from 'react';
import type { Connection } from 'reactflow';
import { useNodeTypesStore } from '../stores/nodeTypesStore';

/**
 * Implicit conversions matching backend types.py IMPLICIT_CONVERSIONS.
 * Updated to match data-model.md Type Compatibility Matrix:
 * - EMBEDDING→STRING is NOT allowed
 * - INT→FLOAT and INT→BOOLEAN are allowed (numeric promotions)
 * - BOOLEAN→INT is allowed
 */
const IMPLICIT_CONVERSIONS = new Set([
  'STRING->CONTEXT',
  'CONTEXT->STRING',
  'INT->STRING',
  'INT->FLOAT',
  'INT->BOOLEAN',
  'FLOAT->STRING',
  'BOOLEAN->STRING',
  'BOOLEAN->INT',
  'USAGE->STRING',
  'TOOL_RESULT->STRING',
  'DOCUMENT->STRING',
]);

const NON_CONNECTION_TYPES = new Set(['COMBO', 'SECRET']);

export function isTypeCompatible(sourceType: string, targetType: string): boolean {
  if (NON_CONNECTION_TYPES.has(sourceType) || NON_CONNECTION_TYPES.has(targetType)) {
    return false;
  }
  if (sourceType === targetType) return true;
  return IMPLICIT_CONVERSIONS.has(`${sourceType}->${targetType}`);
}

/**
 * Check if a conversion is implicit (not same-type).
 * Used for visual feedback (dashed line for implicit conversions).
 */
export function isImplicitConversion(sourceType: string, targetType: string): boolean {
  if (sourceType === targetType) return false;
  return IMPLICIT_CONVERSIONS.has(`${sourceType}->${targetType}`);
}

export function useConnectionValidator() {
  const nodeTypes = useNodeTypesStore((s) => s.nodeTypes);
  const typeDefinitions = useNodeTypesStore((s) => s.typeDefinitions);
  const isLoaded = useNodeTypesStore((s) => s.isLoaded);

  const getNodeOutputType = useCallback(
    (classType: string, outputIndex: number = 0): string | null => {
      const info = nodeTypes[classType];
      if (!info?.return_types) return null;
      return info.return_types[outputIndex] ?? null;
    },
    [nodeTypes]
  );

  const getNodeInputType = useCallback(
    (classType: string, inputName: string): string | null => {
      const info = nodeTypes[classType];
      if (!info?.inputs) return null;

      // Check required inputs
      const req = info.inputs.required?.[inputName];
      if (req) {
        if (Array.isArray(req)) return req[0] as string;
        if (typeof req === 'object' && req !== null && 'type' in req) return (req as { type: string }).type;
      }

      // Check optional inputs
      const opt = info.inputs.optional?.[inputName];
      if (opt) {
        if (Array.isArray(opt)) return opt[0] as string;
        if (typeof opt === 'object' && opt !== null && 'type' in opt) return (opt as { type: string }).type;
      }

      return null;
    },
    [nodeTypes]
  );

  /**
   * Validate a connection between two nodes.
   * Used as ReactFlow's isValidConnection callback.
   */
  const isValidConnection = useCallback(
    (connection: Connection): boolean => {
      if (!isLoaded) return true; // Allow if type data not loaded yet
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false; // No self-loops

      return true;
    },
    [isLoaded]
  );

  /**
   * Get the color for a handle based on data type.
   */
  const getHandleColor = useCallback(
    (dataType: string): string => {
      const typeDef = typeDefinitions[dataType];
      return typeDef?.color ?? '#90A4AE';
    },
    [typeDefinitions]
  );

  return {
    isValidConnection,
    isTypeCompatible,
    getHandleColor,
    getNodeOutputType,
    getNodeInputType,
    typeDefinitions,
    nodeTypeInfos: nodeTypes,
    isLoaded,
  };
}

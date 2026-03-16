/**
 * TypeScript type definitions for the plugin system.
 * Matches the backend GET /api/node-types response contract.
 */

/** Specification for a single input on a node type */
export interface InputSpec {
  type: string;
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  multiline?: boolean;
  dynamic?: boolean;
  label?: string;
}

/** Complete definition of a node type from plugin metadata */
export interface NodeTypeDefinition {
  display_name: string;
  category: string;
  inputs: {
    required: Record<string, InputSpec | [string, ...unknown[]]>;
    optional?: Record<string, InputSpec | [string, ...unknown[]]>;
    credentials?: Record<string, InputSpec | [string, ...unknown[]]>;
  };
  return_types: string[];
  return_names?: string[];
  streaming?: boolean;
  function: string;
  ui: {
    color?: string;
    icon?: string;
    dual_zone?: boolean;
    supports_import?: boolean;
    import_types?: string[];
    [key: string]: unknown;
  };
}

/** Type definition (e.g., STRING, CONTEXT, etc.) */
export interface TypeDefinition {
  color: string;
  description: string;
  is_connection_type: boolean;
}

/** Category info for grouping node types */
export interface CategoryInfo {
  id: string;
  display_name: string;
}

/** Full response from GET /api/node-types */
export interface NodeTypesResponse {
  node_types: Record<string, NodeTypeDefinition>;
  type_definitions: Record<string, TypeDefinition>;
  categories: CategoryInfo[];
}

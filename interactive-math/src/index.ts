/**
 * Interactive Math Library
 * A library for creating interactive mathematical formulas with LLM-powered function generation
 */

// Export the main API
export * from './api/LLMFunctionGenerator';
export * from './InteractiveFormula';

import { InteractiveEquation, EquationOptions, VariableConfig } from './api/InteractiveEquation';
import { RendererType } from './rendering/RendererFactory';

/**
 * Create a new interactive equation
 * @param options Configuration options 
 * @returns An interactive equation instance
 */
export function defineEquation(options: EquationOptions): InteractiveEquation {
  return new InteractiveEquation(options);
}

// Export types for library users
export type { 
  EquationOptions,
  VariableConfig,
  RendererType
};

// Export the InteractiveEquation class for advanced usage
export { InteractiveEquation }; 
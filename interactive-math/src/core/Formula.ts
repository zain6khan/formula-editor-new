import { AugmentedFormula, AugmentedFormulaNode } from './FormulaTree';

/**
 * Interface for formula styled ranges
 */
export interface FormulaLatexRanges {
  ranges: Array<{
    start: number;
    end: number;
    style?: string;
  }>;
}

/**
 * Represents a mathematical formula with variables and interactive components.
 */
export class Formula {
  private _formula: AugmentedFormula;
  private _variables: Map<string, VariableDefinition> = new Map();
  private _changeListeners: Array<(variables: Record<string, VariableValue>) => void> = [];

  /**
   * Creates a new Formula instance
   * @param latex The LaTeX representation of the formula
   * @param variables Optional initial variable definitions
   */
  constructor(latex: string, variables?: Record<string, VariableDefinition>) {
    // Parse the LaTeX into an AugmentedFormula
    this._formula = this.parseLatex(latex);
    
    // Register initial variables if provided
    if (variables) {
      this.registerVariables(variables);
    }
  }

  /**
   * Parse a LaTeX string into an AugmentedFormula
   * @param latex The LaTeX formula string
   * @returns An AugmentedFormula representing the parsed formula
   */
  private parseLatex(latex: string): AugmentedFormula {
    // This will be implemented by importing from the parsing module
    // For now, return a stub implementation
    return {
      children: [],
      toLatex: () => latex,
      findNode: () => null,
      equals: () => false,
      toStyledRanges: () => ({ ranges: [] }),
      toMathML: () => ''
    } as unknown as AugmentedFormula;
  }

  /**
   * Register variables with the formula
   * @param variables Record of variable names to their definitions
   */
  private registerVariables(variables: Record<string, VariableDefinition>): void {
    Object.entries(variables).forEach(([name, definition]) => {
      this._variables.set(name, {
        ...definition,
        value: definition.value ?? 0  // Use 0 as default value if undefined
      });
    });
  }

  /**
   * Get the LaTeX representation of the formula
   * @param mode The rendering mode
   * @returns LaTeX string
   */
  public toLatex(mode: 'display' | 'content-only' = 'display'): string {
    return this._formula.toLatex(mode === 'display' ? 'render' : 'content-only');
  }

  /**
   * Get a variable's definition
   * @param name The variable name
   * @returns The variable definition or undefined if not found
   */
  public getVariable(name: string): (VariableDefinition & { value: number }) | undefined {
    const variable = this._variables.get(name);
    if (!variable) return undefined;
    
    // Since value is optional in the interface but we always ensure it exists,
    // we can safely assert that it's a number
    return variable as VariableDefinition & { value: number };
  }

  /**
   * Get the current values of all variables
   * @returns Record of variable names to their current values
   */
  public getVariableValues(): Record<string, VariableValue> {
    const result: Record<string, VariableValue> = {};
    
    this._variables.forEach((definition, name) => {
      result[name] = {
        value: definition.value ?? 0, // Ensure a default value of 0 if undefined
        units: definition.units,
        type: definition.type
      };
    });
    
    return result;
  }

  /**
   * Update a variable's value
   * @param name The variable name
   * @param value The new value
   */
  public setVariable(name: string, value: number): void {
    const variable = this._variables.get(name);
    
    if (!variable) {
      throw new Error(`Variable ${name} not found`);
    }
    
    if (variable.type === 'output') {
      throw new Error(`Cannot set value of output variable ${name}`);
    }
    
    // Apply range constraints if defined
    if (variable.range) {
      const [min, max] = variable.range;
      value = Math.max(min, Math.min(max, value));
    }
    
    // Apply precision if specified
    if (variable.precision !== undefined) {
      const factor = Math.pow(10, variable.precision);
      value = Math.round(value * factor) / factor;
    }
    
    // Update the value
    variable.value = value;
    
    // Update dependent variables
    this.updateDependentVariables();
    
    // Notify listeners
    this.notifyChangeListeners();
  }

  /**
   * Update dependent variables based on input variables
   */
  private updateDependentVariables(): void {
    // This will be implemented in the computation module
    // For now, it's a placeholder
  }

  /**
   * Set a variable's value directly without type checking
   * This is used to update output variables from computation results
   * @param name The variable name 
   * @param value The new value
   */
  public setVariableDirectly(name: string, value: number): void {
    const variable = this._variables.get(name);
    
    if (!variable) {
      throw new Error(`Variable ${name} not found`);
    }
    
    // Apply precision if specified
    if (variable.precision !== undefined) {
      const factor = Math.pow(10, variable.precision);
      value = Math.round(value * factor) / factor;
    }
    
    // Update the value without checking if it's an output variable
    variable.value = value;
    
    // Notify listeners without updating dependent variables
    this.notifyChangeListeners();
  }

  /**
   * Register a change listener that will be called when variables change
   * @param listener Function to call on changes
   * @returns A function to remove the listener
   */
  public onChange(listener: (variables: Record<string, VariableValue>) => void): () => void {
    this._changeListeners.push(listener);
    
    return () => {
      const index = this._changeListeners.indexOf(listener);
      if (index >= 0) {
        this._changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all registered change listeners
   */
  private notifyChangeListeners(): void {
    const values = this.getVariableValues();
    this._changeListeners.forEach(listener => listener(values));
  }
}

/**
 * Types of variables supported in the formula
 */
export type VariableType = 'constant' | 'slideable' | 'scrubbable' | 'output';

/**
 * Variable definition for use in formula creation
 */
export interface VariableDefinition {
  /** Type of the variable */
  type: VariableType;
  
  /** Initial value */
  value?: number;
  
  /** Range constraints for input variables [min, max] */
  range?: [number, number];
  
  /** Number of decimal places to show */
  precision?: number;
  
  /** Units to display with the value */
  units?: string;
}

/**
 * Current state of a variable
 */
export interface VariableValue {
  /** Current numeric value */
  value: number;
  
  /** Units to display with the value */
  units?: string;
  
  /** Type of the variable */
  type: VariableType;
} 
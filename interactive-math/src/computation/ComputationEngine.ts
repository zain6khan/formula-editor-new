import { VariableDefinition, VariableType } from '../core/Formula';
import { generateEvaluationFunction as llmGenerateFunction, VariableDefinition as LLMVariableDefinition } from '../api/LLMFunctionGenerator';

/**
 * Variable information for computation
 */
export interface ComputationVariable {
  /** The variable symbol (e.g., "x", "y") */
  symbol: string;
  
  /** Current value of the variable */
  value: number;
  
  /** Type of variable */
  type: VariableType;
  
  /** Minimum allowed value (for input variables) */
  min?: number;
  
  /** Maximum allowed value (for input variables) */
  max?: number;
  
  /** Set of variable symbols this variable depends on */
  dependencies?: Set<string>;
  
  /** Error message if computation failed */
  error?: string;
}

/**
 * A function that evaluates variable values
 */
export type EvaluationFunction = (variables: Record<string, number>) => Record<string, number>;

/**
 * Engine for handling computations and variable dependencies
 */
export class ComputationEngine {
  /** Map of variable symbols to their computation state */
  private variables = new Map<string, ComputationVariable>();
  
  /** The formula being computed */
  private formula: string = "";
  
  /** Any error in the formula computation */
  private formulaError: string | null = null;
  
  /** The last generated computation code */
  private lastGeneratedCode: string | null = null;
  
  /** The compiled evaluation function */
  private evaluationFunction: EvaluationFunction | null = null;
  
  /** Flag to prevent circular updates */
  private isUpdatingDependents = false;
  
  /** Set of variable symbols that are dependent (outputs) */
  private dependentVariables = new Set<string>();
  
  /** Callback for when variable values change */
  private onVariableChange: ((variables: Record<string, number>) => void) | null = null;

  /**
   * Helper method to clean variable symbols by removing dollar signs
   * @param symbol The variable symbol to clean
   * @returns The cleaned symbol without dollar signs
   */
  private cleanSymbol(symbol: string): string {
    return symbol.replace(/\$/g, '');
  }

  /**
   * Set the callback for when variables change
   * @param callback Function to call when variables change
   */
  public setVariableChangeCallback(callback: (variables: Record<string, number>) => void): void {
    this.onVariableChange = callback;
  }

  /**
   * Set the formula used for computation
   * @param formula The formula in LaTeX format
   */
  public async setFormula(formula: string): Promise<void> {
    const prevFormula = this.formula;
    this.formula = formula;
    
    console.log("DEBUG - Setting formula:", formula);
    console.log("DEBUG - Previous formula:", prevFormula);
    
    // Clear existing code if formula changed
    if (prevFormula !== formula) {
      console.log("DEBUG - Formula changed, clearing previous function");
      this.lastGeneratedCode = null;
      this.evaluationFunction = null;
    }
    
    // Only regenerate the evaluation function if there are dependent variables
    if (this.dependentVariables.size > 0 && 
        (!this.evaluationFunction || formula !== prevFormula)) {
      try {
        console.log("DEBUG - Generating evaluation function for dependent variables:", 
                     Array.from(this.dependentVariables));
        
        const dependentVars = Array.from(this.dependentVariables)
          .map(symbol => this.variables.get(symbol)?.symbol)
          .filter((symbol): symbol is string => symbol !== undefined);

        console.log("DEBUG - Filtered dependent variables:", dependentVars);

        // Generate code for evaluation
        const functionCode = await this.generateEvaluationFunction(formula, dependentVars);
        this.lastGeneratedCode = functionCode;
        
        console.log("DEBUG - Generated function code:", functionCode);
        
        // Create the evaluation function
        this.evaluationFunction = new Function(
          'variables',
          `"use strict";\n${functionCode}\nreturn evaluate(variables);`
        ) as EvaluationFunction;
        
        console.log("DEBUG - Created evaluation function:", !!this.evaluationFunction);
        
        this.formulaError = null;
      } catch (error) {
        console.error("Error setting formula:", error);
        this.formulaError = String(error);
      }
    } else {
      console.log("DEBUG - Not regenerating evaluation function:",
                  "dependentVariables.size =", this.dependentVariables.size,
                  "evaluationFunction exists =", !!this.evaluationFunction,
                  "formula === prevFormula =", formula === prevFormula);
    }
    
    // Always update dependent variables when formula changes
    if (this.dependentVariables.size > 0) {
      console.log("DEBUG - Updating dependent variables after setting formula");
      this.updateDependentVariables();
    }
  }

  /**
   * Generate JavaScript code to evaluate the formula
   * @param formula The LaTeX formula
   * @param dependentVars Variable symbols that are outputs
   * @returns JavaScript code as a string
   */
  private async generateEvaluationFunction(formula: string, dependentVars: string[]): Promise<string> {
    try {
      // Convert internal variables to LLMVariableDefinition format
      const variableDefinitions: LLMVariableDefinition[] = Array.from(this.variables.entries()).map(([symbol, v]) => ({
        symbol,
        type: v.type === 'output' ? 'output' : 'input', // Map internal types to LLM types
        value: v.value,
        range: v.min !== undefined && v.max !== undefined ? [v.min, v.max] : undefined,
      }));
      
      // Use the LLM function generator
      console.log("Sending to LLM function generator:", {
        formula,
        variables: variableDefinitions
      });
      
      let result;
      try {
        result = await llmGenerateFunction(formula, variableDefinitions);
        console.log("✅ LLM function generation successful");
      } catch (apiError) {
        console.error("❌ LLM API error:", apiError);
        // No hardcoded fallback implementation, just rethrow the error
        throw apiError;
      }
      
      return result.code;
    } catch (error) {
      console.error("Error generating evaluation function:", error);
      // Fallback to a basic function that returns zeros for all dependent variables
      return `
function evaluate(variables) {
  return {
    ${dependentVars.map(v => `"${v}": 0`).join(',\n    ')}
  };
}`;
    }
  }

  /**
   * Register a variable with the computation engine
   * @param symbol The variable symbol
   * @param definition The variable definition
   */
  public registerVariable(symbol: string, definition: VariableDefinition): void {
    const computationVar: ComputationVariable = {
      symbol,
      value: definition.value ?? 0,
      type: definition.type,
      min: definition.range?.[0],
      max: definition.range?.[1],
    };
    
    this.variables.set(symbol, computationVar);
    
    // Track dependent variables
    if (definition.type === 'output') {
      this.dependentVariables.add(symbol);
    }
  }

  /**
   * Update the value of a variable
   * @param symbol The variable symbol
   * @param value The new value
   */
  public setValue(symbol: string, value: number): void {
    console.log(`🔶 ComputationEngine.setValue called with symbol: ${symbol}, value: ${value}`);
    
    // Check if the variable exists
    const variable = this.variables.get(symbol);
    if (!variable) {
      console.error(`❌ ComputationEngine: Variable ${symbol} not found`);
      console.log(`🔍 Available variables:`, Array.from(this.variables.keys()));
      
      // Try some alternative formats
      const cleanSymbol = this.cleanSymbol(symbol);
      if (cleanSymbol !== symbol && this.variables.has(cleanSymbol)) {
        console.log(`🔍 Found matching variable with clean symbol: ${cleanSymbol}`);
        return this.setValue(cleanSymbol, value);
      }
      
      throw new Error(`Variable ${symbol} not found`);
    }
    
    if (variable.type === 'output') {
      console.error(`❌ ComputationEngine: Cannot set value of output variable ${symbol}`);
      throw new Error(`Cannot set value of output variable ${symbol}`);
    }
    
    // Log the current value before change
    console.log(`🔍 ComputationEngine: Current value of ${symbol}: ${variable.value}, new value: ${value}`);
    
    // Apply constraints if defined
    let finalValue = value;
    if (variable.min !== undefined && variable.max !== undefined) {
      const constrained = Math.max(variable.min, Math.min(variable.max, value));
      if (constrained !== value) {
        console.log(`🔍 ComputationEngine: Value constrained from ${value} to ${constrained} (range: ${variable.min}-${variable.max})`);
      }
      finalValue = constrained;
    }
    
    // Update the value
    variable.value = finalValue;
    variable.error = undefined;
    
    console.log(`✅ ComputationEngine: Variable ${symbol} updated to ${finalValue}`);
    
    // Update dependent variables if needed
    if (!this.isUpdatingDependents) {
      console.log(`🔍 ComputationEngine: Triggering update of dependent variables`);
      this.updateDependentVariables();
    } else {
      console.log(`🔍 ComputationEngine: Skipping dependent variable update (already updating)`);
    }
  }

  /**
   * Update dependent variables based on current input values
   */
  private updateDependentVariables(): void {
    console.log(`🔶 ComputationEngine.updateDependentVariables called`);
    console.log(`🔍 isUpdatingDependents: ${this.isUpdatingDependents}, evaluationFunction exists: ${!!this.evaluationFunction}`);
    
    if (this.isUpdatingDependents || !this.evaluationFunction) {
      console.log("❌ Not updating dependent variables because:", 
        this.isUpdatingDependents ? "already updating" : "no evaluation function");
      return;
    }
    
    try {
      console.log(`🔍 Starting dependent variable update (${this.dependentVariables.size} dependent variables)`);
      this.isUpdatingDependents = true;
      
      // Create input values map
      const inputValues: Record<string, number> = {};
      for (const [symbol, variable] of this.variables.entries()) {
        if (variable.type !== 'output') {
          // Remove dollar signs from variable names to match the function expectations
          const cleanSymbol = this.cleanSymbol(symbol);
          inputValues[cleanSymbol] = variable.value;
        }
      }
      
      console.log("🔍 Input values for evaluation:", inputValues);
      console.log("🔍 Evaluation function exists:", this.evaluationFunction !== null);
      
      if (this.lastGeneratedCode) {
        console.log("🔍 Using evaluation code:", this.lastGeneratedCode.substring(0, 200) + (this.lastGeneratedCode.length > 200 ? "..." : ""));
      } else {
        console.log("⚠️ No generated code available");
      }
      
      // Evaluate the formula
      console.log("🔍 Calling evaluation function");
      const results = this.evaluationFunction(inputValues);
      console.log("🔍 Results from evaluation:", results);
      
      // Update dependent variables
      let updatedCount = 0;
      for (const symbol of this.dependentVariables) {
        // Get the clean symbol without dollar signs
        const cleanSymbol = this.cleanSymbol(symbol);
        console.log(`🔍 Checking for result for dependent variable: ${cleanSymbol}`);
        
        if (results[cleanSymbol] !== undefined) {
          const variable = this.variables.get(symbol);
          if (variable && variable.type === 'output') {
            const oldValue = variable.value;
            const newValue = results[cleanSymbol];
            console.log(`🔍 Updating output variable ${symbol} from ${oldValue} to ${newValue} (delta: ${newValue - oldValue})`);
            variable.value = newValue;
            variable.error = undefined;
            updatedCount++;
          }
        } else {
          console.error(`❌ Output variable ${cleanSymbol} not found in results:`, results);
          
          // Check if there's a differently formatted key in the results
          const matchingKey = Object.keys(results).find(key => 
            key.toLowerCase() === cleanSymbol.toLowerCase() || 
            this.cleanSymbol(key).toLowerCase() === cleanSymbol.toLowerCase()
          );
          
          if (matchingKey) {
            console.log(`🔍 Found case-insensitive match in results: ${matchingKey} for ${cleanSymbol}`);
            const variable = this.variables.get(symbol);
            if (variable && variable.type === 'output') {
              console.log(`🔍 Updating output variable ${symbol} from ${variable.value} to ${results[matchingKey]}`);
              variable.value = results[matchingKey];
              variable.error = undefined;
              updatedCount++;
            }
          }
        }
      }
      
      console.log(`🔍 Updated ${updatedCount} of ${this.dependentVariables.size} dependent variables`);
      
      // Directly update DOM output variables if possible
      // This provides immediate visual feedback even if re-rendering is delayed
      try {
        for (const symbol of this.dependentVariables) {
          const variable = this.variables.get(symbol);
          if (variable && variable.type === 'output') {
            // Try to find the element in the DOM
            const cleanSymbol = this.cleanSymbol(symbol);
            
            // Look for elements with the correct styling (green color for output variables)
            const elements = document.querySelectorAll(`[style*="color: green"]`);
            console.log(`🔄 Looking for DOM elements for ${cleanSymbol}, found ${elements.length} green elements`);
            
            if (elements.length > 0) {
              elements.forEach(el => {
                const text = el.textContent || "";
                
                // Check if this element contains our variable's text
                if (text.includes(cleanSymbol) && text.includes(':')) {
                  console.log(`🔄 Found matching element for ${cleanSymbol}:`, el);
                  
                  // Format the value with precision
                  const precision = 2; // Default precision
                  const formatted = variable.value.toFixed(precision);
                  
                  // Try to update the text content
                  try {
                    const parts = text.split(':');
                    if (parts.length > 1) {
                      const newContent = `${parts[0]}: ${formatted}`;
                      console.log(`🔄 Updating element for ${cleanSymbol} to: ${newContent}`);
                      el.textContent = newContent;
                    }
                  } catch (e) {
                    console.error(`Error updating element text for ${cleanSymbol}:`, e);
                  }
                }
              });
            }
          }
        }
      } catch (updateError) {
        console.error("Error directly updating DOM:", updateError);
      }
      
      // Notify of changes
      if (this.onVariableChange) {
        const allValues: Record<string, number> = {};
        for (const [symbol, variable] of this.variables.entries()) {
          allValues[symbol] = variable.value;
        }
        console.log("Calling onVariableChange with values:", allValues);
        this.onVariableChange(allValues);
        console.log("✅ onVariableChange callback completed");
      } else {
        console.log("⚠️ No onVariableChange callback registered");
      }
    } catch (error) {
      console.error("❌ Error updating dependent variables:", error);
      
      // Set error on all dependent variables
      for (const symbol of this.dependentVariables) {
        const variable = this.variables.get(symbol);
        if (variable) {
          variable.error = String(error);
        }
      }
    } finally {
      this.isUpdatingDependents = false;
      console.log("🔍 Finished updating dependent variables");
    }
  }

  /**
   * Get the current values of all variables
   * @returns Record mapping variable symbols to values
   */
  public getVariableValues(): Record<string, number> {
    const values: Record<string, number> = {};
    for (const [symbol, variable] of this.variables.entries()) {
      values[symbol] = variable.value;
    }
    return values;
  }

  /**
   * Get errors if any exist
   * @returns True if errors exist, false otherwise
   */
  public hasErrors(): boolean {
    return this.formulaError !== null || 
      Array.from(this.variables.values()).some(v => v.error !== undefined);
  }

  /**
   * Get debug information about current state
   * @returns Object with debug information
   */
  public getDebugInfo() {
    return {
      formula: this.formula,
      formulaError: this.formulaError,
      variables: Array.from(this.variables.entries()).map(([symbol, v]) => ({
        symbol,
        value: v.value,
        type: v.type,
        error: v.error
      })),
      lastGeneratedCode: this.lastGeneratedCode,
      hasFunction: this.evaluationFunction !== null,
      dependentVariables: Array.from(this.dependentVariables)
    };
  }
} 
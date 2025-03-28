/**
 * InteractiveFormula.ts
 * Core class for creating interactive formulas using LLM-powered function generation
 */

import { 
  VariableDefinition, 
  VariableType, 
  generateEvaluationFunction, 
  executeEvaluationFunction,
  FunctionGenerationResult
} from './api/LLMFunctionGenerator';

/**
 * Options for creating an interactive formula
 */
export interface InteractiveFormulaOptions {
  /** Formula in LaTeX format */
  formula: string;
  
  /** Initial variable definitions */
  variables: VariableDefinition[];
  
  /** OpenAI model to use (defaults to gpt-3.5-turbo) */
  model?: string;
  
  /** Callback for when variables change */
  onVariableChange?: (variables: VariableDefinition[]) => void;
  
  /** Callback for when the formula updates */
  onFormulaUpdate?: (formula: string) => void;
  
  /** Callback for when the code is generated */
  onCodeGeneration?: (code: string) => void;
  
  /** Callback for errors */
  onError?: (error: Error) => void;
}

/**
 * InteractiveFormula class for creating and managing interactive mathematical formulas
 */
export class InteractiveFormula {
  /** Formula in LaTeX format */
  private _formula: string;
  
  /** Variable definitions */
  private _variables: VariableDefinition[];
  
  /** Generated function information */
  private _functionResult: FunctionGenerationResult | null = null;
  
  /** Options for the interactive formula */
  private _options: InteractiveFormulaOptions;
  
  /** Flag to indicate if the formula is being updated */
  private _isUpdating = false;
  
  /**
   * Create a new interactive formula
   * @param options Configuration options
   */
  constructor(options: InteractiveFormulaOptions) {
    this._formula = options.formula;
    this._variables = [...options.variables];
    this._options = options;
    
    // Generate the initial function if we have dependent variables
    if (this.hasOutputVariables) {
      this.generateFunction();
    }
  }
  
  /**
   * Get the current formula
   */
  get formula(): string {
    return this._formula;
  }
  
  /**
   * Set a new formula
   */
  set formula(formula: string) {
    if (formula === this._formula) return;
    
    this._formula = formula;
    
    // Notify listeners
    if (this._options.onFormulaUpdate) {
      this._options.onFormulaUpdate(formula);
    }
    
    // Regenerate the function
    if (this.hasOutputVariables) {
      this.generateFunction();
    }
  }
  
  /**
   * Get all variables
   */
  get variables(): ReadonlyArray<VariableDefinition> {
    return this._variables;
  }
  
  /**
   * Get input variables
   */
  get inputVariables(): ReadonlyArray<VariableDefinition> {
    return this._variables.filter(v => v.type === 'input');
  }
  
  /**
   * Get output variables
   */
  get outputVariables(): ReadonlyArray<VariableDefinition> {
    return this._variables.filter(v => v.type === 'output');
  }
  
  /**
   * Check if there are any output variables
   */
  get hasOutputVariables(): boolean {
    return this._variables.some(v => v.type === 'output');
  }
  
  /**
   * Get the generated function code
   */
  get generatedCode(): string | null {
    return this._functionResult?.code || null;
  }
  
  /**
   * Update a variable's value
   * @param symbol Variable symbol
   * @param value New value
   */
  updateVariable(symbol: string, value: number): void {
    const index = this._variables.findIndex(v => v.symbol === symbol);
    if (index === -1) return;
    
    const variable = this._variables[index];
    
    // Don't update output variables directly
    if (variable.type === 'output') return;
    
    // Apply min/max constraints
    if (variable.min !== undefined && value < variable.min) {
      value = variable.min;
    }
    if (variable.max !== undefined && value > variable.max) {
      value = variable.max;
    }
    
    // Update the variable
    this._variables[index] = {
      ...variable,
      value,
      error: undefined
    };
    
    // Notify listeners
    if (this._options.onVariableChange) {
      this._options.onVariableChange(this._variables);
    }
    
    // Update dependent variables
    if (!this._isUpdating && this.hasOutputVariables) {
      this.updateOutputVariables();
    }
  }
  
  /**
   * Add a new variable
   * @param variable Variable definition
   * @returns True if added successfully
   */
  addVariable(variable: VariableDefinition): boolean {
    // Check if variable already exists
    if (this._variables.some(v => v.symbol === variable.symbol)) {
      return false;
    }
    
    // Add the variable
    this._variables.push(variable);
    
    // Notify listeners
    if (this._options.onVariableChange) {
      this._options.onVariableChange(this._variables);
    }
    
    // Regenerate the function if needed
    if (variable.type === 'output' || this.hasOutputVariables) {
      this.generateFunction();
    }
    
    return true;
  }
  
  /**
   * Remove a variable
   * @param symbol Variable symbol
   * @returns True if removed successfully
   */
  removeVariable(symbol: string): boolean {
    const index = this._variables.findIndex(v => v.symbol === symbol);
    if (index === -1) return false;
    
    // Remove the variable
    this._variables.splice(index, 1);
    
    // Notify listeners
    if (this._options.onVariableChange) {
      this._options.onVariableChange(this._variables);
    }
    
    // Regenerate the function if needed
    if (this.hasOutputVariables) {
      this.generateFunction();
    }
    
    return true;
  }
  
  /**
   * Change a variable's type
   * @param symbol Variable symbol
   * @param type New variable type
   * @returns True if changed successfully
   */
  setVariableType(symbol: string, type: VariableType): boolean {
    const index = this._variables.findIndex(v => v.symbol === symbol);
    if (index === -1) return false;
    
    // Update the variable type
    this._variables[index] = {
      ...this._variables[index],
      type,
      error: undefined
    };
    
    // Notify listeners
    if (this._options.onVariableChange) {
      this._options.onVariableChange(this._variables);
    }
    
    // Regenerate the function if needed
    if (type === 'output' || this.hasOutputVariables) {
      this.generateFunction();
    }
    
    return true;
  }
  
  /**
   * Update all output variables using the evaluation function
   */
  private updateOutputVariables(): void {
    if (!this._functionResult || !this._functionResult.evaluationFunction) {
      return;
    }
    
    try {
      this._isUpdating = true;
      
      // Execute the evaluation function
      const results = executeEvaluationFunction(
        this._functionResult.evaluationFunction, 
        this._variables
      );
      
      // Update output variables with results
      let hasChanges = false;
      
      this._variables.forEach((variable, index) => {
        if (variable.type === 'output' && results[variable.symbol] !== undefined) {
          const value = results[variable.symbol];
          
          // Only update if the value changed
          if (this._variables[index].value !== value) {
            this._variables[index] = {
              ...variable,
              value,
              error: undefined
            };
            hasChanges = true;
          }
        }
      });
      
      // Notify listeners if there were changes
      if (hasChanges && this._options.onVariableChange) {
        this._options.onVariableChange(this._variables);
      }
    } catch (error) {
      console.error("Error updating output variables:", error);
      
      // Mark output variables with an error
      this._variables.forEach((variable, index) => {
        if (variable.type === 'output') {
          this._variables[index] = {
            ...variable,
            error: "Evaluation error"
          };
        }
      });
      
      // Notify error handler
      if (this._options.onError) {
        this._options.onError(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      this._isUpdating = false;
    }
  }
  
  /**
   * Generate the evaluation function for the formula
   */
  async generateFunction(): Promise<void> {
    try {
      // Show that we're generating the function
      console.log(`Generating evaluation function for formula: ${this._formula}`);
      
      // Generate the evaluation function
      this._functionResult = await generateEvaluationFunction(
        this._formula,
        this._variables,
        {
          model: this._options.model
        }
      );
      
      // Notify code generation listeners
      if (this._options.onCodeGeneration && this._functionResult.code) {
        this._options.onCodeGeneration(this._functionResult.code);
      }
      
      // Update output variables
      this.updateOutputVariables();
    } catch (error) {
      console.error("Error generating function:", error);
      
      // Mark output variables with an error
      this._variables.forEach((variable, index) => {
        if (variable.type === 'output') {
          this._variables[index] = {
            ...variable,
            error: "Function generation failed"
          };
        }
      });
      
      // Notify variable change listeners about the error state
      if (this._options.onVariableChange) {
        this._options.onVariableChange(this._variables);
      }
      
      // Notify error handler
      if (this._options.onError) {
        this._options.onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
} 
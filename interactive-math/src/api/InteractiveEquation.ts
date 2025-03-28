import { Formula, VariableDefinition, VariableType, VariableValue } from '../core/Formula';
import { ComputationEngine } from '../computation/ComputationEngine';
import { FormulaRenderer, RendererFactory, RendererType } from '../rendering/RendererFactory';

/**
 * Options for creating an interactive equation
 */
export interface EquationOptions {
  /** LaTeX formula string */
  formula: string;
  
  /** Variable definitions */
  variables: Record<string, VariableConfig>;
  
  /** Preferred rendering backend */
  renderer?: RendererType;
}

/**
 * Configuration for a variable
 */
export interface VariableConfig {
  /** Type of variable */
  type: 'constant' | 'output' | 'slideable' | 'scrubbable';
  
  /** Initial/fixed value */
  value?: number;
  
  /** For slideable/scrubbable variables, allowed range [min, max] */
  range?: [number, number];
  
  /** Number of decimal places to show */
  precision?: number;
  
  /** Units to display with the value */
  units?: string;
}

/**
 * Main class representing an interactive equation
 */
export class InteractiveEquation {
  private formula: Formula;
  private computationEngine: ComputationEngine;
  private renderer: FormulaRenderer;
  private container: HTMLElement | null = null;
  private changeListeners: Array<(values: Record<string, VariableValue>) => void> = [];
  
  /**
   * Create a new interactive equation
   * @param options Configuration options
   */
  constructor(options: EquationOptions) {
    // Convert variable configs to internal format
    const variableDefinitions: Record<string, VariableDefinition> = {};
    
    for (const [symbol, config] of Object.entries(options.variables)) {
      // Map external types to internal types
      let type: VariableType;
      switch (config.type) {
        case 'constant':
          type = 'constant';
          break;
        case 'output':
          type = 'output';
          break;
        case 'slideable':
          type = 'slideable';
          break;
        case 'scrubbable':
          type = 'scrubbable';
          break;
      }
        
      variableDefinitions[symbol] = {
        type,
        value: config.value,
        range: config.range,
        precision: config.precision,
        units: config.units
      };
    }
    
    // Create core formula
    this.formula = new Formula(options.formula, variableDefinitions);
    
    // Create computation engine
    this.computationEngine = new ComputationEngine();
    
    // Register variables with computation engine
    for (const [symbol, definition] of Object.entries(variableDefinitions)) {
      this.computationEngine.registerVariable(symbol, definition);
    }
    
    // Set up computation engine callback
    this.computationEngine.setVariableChangeCallback((values) => {
      // Sync computed values back to the Formula object
      for (const [symbol, value] of Object.entries(values)) {
        const variable = this.formula.getVariable(symbol);
        if (variable && variable.type === 'output') {
          // Update the formula's variable with the computed value
          // but don't trigger the computation engine again
          this.formula.setVariableDirectly(symbol, value);
        }
      }

      // Now notify listeners and update the rendering
      this.notifyChangeListeners();
      this.updateRendering();
    });
    
    // Set formula in computation engine
    this.computationEngine.setFormula(options.formula);
    
    // Get renderer
    this.renderer = RendererFactory.getRenderer(options.renderer);
  }
  
  /**
   * Render the equation into a container element
   * @param container HTML element to render into
   * @returns Promise that resolves when rendering is complete
   */
  public async renderTo(container: HTMLElement): Promise<void> {
    this.container = container;
    
    // Initialize renderer
    await this.renderer.initialize();
    
    // Render the formula
    await this.updateRendering();
    
    // Set up interactivity
    this.renderer.setupInteractivity(container, this.handleVariableChange.bind(this));
  }
  
  /**
   * Update the rendering of the formula
   */
  private async updateRendering(): Promise<void> {
    console.log(`🔷 InteractiveEquation.updateRendering called`);
    
    if (!this.container) {
      console.log(`⚠️ No container to render into`);
      return;
    }
    
    console.log(`🔍 Rendering to container:`, this.container);
    
    try {
      // Get all variable values
      const variables = this.getVariableValues();
      console.log(`🔍 Current variable values:`, variables);
      
      // Get all variable definitions for additional data
      const variableDefinitions = new Map<string, VariableDefinition>();
      for (const [symbol, _] of Object.entries(variables)) {
        const varDef = this.formula.getVariable(symbol);
        if (varDef) {
          variableDefinitions.set(symbol, varDef);
        }
      }
      
      console.log(`🔍 Variable definitions:`, Array.from(variableDefinitions.entries()));
      
      // Convert to renderer format
      const rendererVariables: Record<string, { 
        value: number; 
        type: string; 
        units?: string;
        range?: [number, number];
        precision?: number;
      }> = {};
      
      for (const [symbol, value] of Object.entries(variables)) {
        const definition = variableDefinitions.get(symbol);
        
        rendererVariables[symbol] = {
          value: value.value,
          type: value.type,
          units: value.units,
          range: definition?.range,
          precision: definition?.precision
        };
      }
      
      console.log(`🔍 Prepared renderer variables:`, rendererVariables);
      
      // Render
      console.log(`🔍 Calling renderer.render`);
      await this.renderer.render(
        this.container,
        this.formula.toLatex(),
        rendererVariables
      );
      
      console.log(`✅ Rendering completed successfully`);
      
      // Re-setup interactivity
      console.log(`🔍 Setting up interactivity after render`);
      this.renderer.setupInteractivity(this.container, this.handleVariableChange.bind(this));
      
    } catch (error) {
      console.error(`❌ Error in updateRendering:`, error);
    }
  }
  
  /**
   * Handle a variable change from the renderer
   * @param symbol Variable symbol
   * @param value New value
   */
  private handleVariableChange(symbol: string, value: number): void {
    console.log(`⚡ [VARIABLE_CHANGE] InteractiveEquation.handleVariableChange called with symbol: ${symbol}, value: ${value}`);
    
    // Get the current value of the variable
    const variables = this.getVariableValues();
    const currentValue = variables[symbol]?.value;
    
    console.log(`⚡ [BEFORE_UPDATE] Current value of ${symbol}: ${currentValue}, new value: ${value}, change: ${value - (currentValue || 0)}`);
    
    // Log available variable symbols
    console.log(`⚡ Available variables:`, Object.keys(variables));
    
    // Check if the symbol is in a different format than our stored variables
    if (!variables[symbol]) {
      console.log(`⚠️ Symbol ${symbol} not found directly in variables. Looking for alternatives...`);
      // Try without dollar signs
      const cleanSymbol = symbol.replace(/^\$|\$$/g, '');
      if (variables[cleanSymbol]) {
        console.log(`⚡ Found matching variable with cleaned symbol: ${cleanSymbol}`);
        symbol = cleanSymbol;
      } else {
        // Try with added dollar signs
        const dollarSymbol = `$${symbol}$`;
        if (variables[dollarSymbol]) {
          console.log(`⚡ Found matching variable with dollar-wrapped symbol: ${dollarSymbol}`);
          symbol = dollarSymbol;
        } else {
          console.error(`❌ Could not find a matching variable for symbol: ${symbol}`);
          // Try case-insensitive match as last resort
          const matchingKey = Object.keys(variables).find(key => 
            key.toLowerCase() === symbol.toLowerCase() || 
            key.replace(/^\$|\$$/g, '').toLowerCase() === symbol.replace(/^\$|\$$/g, '').toLowerCase()
          );
          if (matchingKey) {
            console.log(`⚡ Found case-insensitive match: ${matchingKey} for ${symbol}`);
            symbol = matchingKey;
          } else {
            console.error(`❌ [ERROR] No matching variable found for ${symbol} - SKIPPING UPDATE`);
            return;
          }
        }
      }
    }
    
    try {
      // CRITICAL: Update formula first
      console.log(`⚡ [STATE_UPDATE] Updating formula with ${symbol}=${value}`);
      this.formula.setVariable(symbol, value);
      
      // CRITICAL: Update computation engine - this is the key step that updates the state
      console.log(`⚡ [STATE_UPDATE] Updating computation engine with ${symbol}=${value}`);
      this.computationEngine.setValue(symbol, value);
      
      // CRITICAL: Force an immediate re-render - this is essential to ensure the UI updates
      console.log(`⚡ [RENDER_TRIGGER] Forcing immediate re-render after variable change`);
      this.updateRendering();
        
      // Double-check the variable updated correctly
      const postUpdateVariables = this.getVariableValues();
      console.log(`⚡ [AFTER_UPDATE] Post-update value of ${symbol}: ${postUpdateVariables[symbol]?.value}`);
      
      // Verify dependent variable updates
      if (this.formula.getVariable(symbol)?.type !== 'output') {
        console.log(`⚡ [DEPENDENT_CHECK] Checking dependent variables after update of ${symbol}`);
        for (const [otherSymbol, varInfo] of Object.entries(postUpdateVariables)) {
          if (varInfo.type === 'output') {
            console.log(`⚡ [OUTPUT_VAR] Output variable ${otherSymbol} = ${varInfo.value}`);
          }
        }
      }
      
      console.log(`✅ [SUCCESS] Variable ${symbol} successfully updated to ${value}`);
    } catch (error) {
      console.error(`❌ [ERROR] Error updating variable ${symbol}:`, error);
    }
  }
  
  /**
   * Register a callback for when variables change
   * @param listener Function to call when variables change
   * @returns Function to remove the listener
   */
  public onChange(listener: (variables: Record<string, VariableValue>) => void): () => void {
    this.changeListeners.push(listener);
    
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index >= 0) {
        this.changeListeners.splice(index, 1);
      }
    };
  }
  
  /**
   * Notify all change listeners
   */
  private notifyChangeListeners(): void {
    const values = this.getVariableValues();
    this.changeListeners.forEach(listener => listener(values));
  }
  
  /**
   * Get the current values of all variables
   * @returns Record mapping variable symbols to their values
   */
  public getVariableValues(): Record<string, VariableValue> {
    return this.formula.getVariableValues();
  }
  
  /**
   * Set the value of a variable
   * @param symbol Variable symbol
   * @param value New value
   */
  public setVariable(symbol: string, value: number): void {
    // Update formula
    this.formula.setVariable(symbol, value);
    
    // Update computation engine
    this.computationEngine.setValue(symbol, value);
  }
} 
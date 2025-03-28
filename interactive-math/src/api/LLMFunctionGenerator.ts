/**
 * LLMFunctionGenerator.ts
 * API for automatically generating evaluation functions from mathematical formulas using OpenAI
 */

// Add TypeScript declaration for import.meta.env
declare global {
  interface ImportMeta {
    env: Record<string, string>;
  }
}

/**
 * Types of variables in a formula
 */
export type VariableType = 'input' | 'output' | 'constant';

/**
 * Variable definition for use in formula computation
 */
export interface VariableDefinition {
  /** Symbol that represents the variable (e.g., "x", "y") */
  symbol: string;
  /** Type of the variable (input, output, constant) */
  type: VariableType;
  /** Current value of the variable */
  value: number;
  /** Minimum allowed value (for input variables) */
  min?: number;
  /** Maximum allowed value (for input variables) */
  max?: number;
  /** Units to display with the value */
  units?: string;
  /** Error message if computation failed */
  error?: string;
}

/**
 * Result of function generation
 */
export interface FunctionGenerationResult {
  /** The generated function code */
  code: string;
  /** Compiled evaluation function */
  evaluationFunction: (variables: Record<string, number>) => Record<string, number>;
}

/**
 * Options for function generation
 */
export interface FunctionGenerationOptions {
  /** OpenAI model to use */
  model?: string;
  /** Temperature for generation */
  temperature?: number;
}

// Get API key from environment variable or global state
function getApiKey(): string {
  // Check for browser global
  if (typeof window !== 'undefined') {
    // Check for global variables
    if ((window as any).OPENAI_API_KEY) {
      return (window as any).OPENAI_API_KEY;
    }
    if ((window as any).VITE_OPENAI_API_KEY) {
      return (window as any).VITE_OPENAI_API_KEY;
    }
  }
  
  // Check for Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.OPENAI_API_KEY) {
      return process.env.OPENAI_API_KEY;
    }
    if (process.env.VITE_OPENAI_API_KEY) {
      return process.env.VITE_OPENAI_API_KEY;
    }
  }
  
  return '';
}

/**
 * Clean a variable symbol by removing dollar signs
 * @param symbol The variable symbol to clean
 * @returns The cleaned symbol
 */
function cleanSymbol(symbol: string): string {
  return symbol.replace(/\$/g, '');
}

/**
 * Generate an evaluation function from a formula and variable definitions
 * @param formula The formula in LaTeX format
 * @param variables List of variable definitions
 * @param options Options for function generation
 * @returns Promise resolving to function generation result
 */
export async function generateEvaluationFunction(
  formula: string,
  variables: VariableDefinition[],
  options: FunctionGenerationOptions = {}
): Promise<FunctionGenerationResult> {
  // Set default options
  const model = options.model || 'gpt-3.5-turbo';
  const temperature = options.temperature ?? 0.1;
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("OpenAI API key not found. Please set the VITE_OPENAI_API_KEY environment variable.");
  }

  // Separate input and output variables
  const inputVars = variables
    .filter(v => v.type !== 'output')
    .map(v => v.symbol);
  
  const outputVars = variables
    .filter(v => v.type === 'output')
    .map(v => v.symbol);

  if (outputVars.length === 0) {
    throw new Error("At least one output variable must be defined");
  }

  console.log("Generating evaluation function for formula:", formula);
  console.log("Input variables:", inputVars);
  console.log("Output variables:", outputVars);
  
  // Log the full variable definitions for debugging
  console.log("Variable definitions:");
  variables.forEach(v => {
    console.log(`- ${v.symbol}: type=${v.type}, value=${v.value}, range=${v.min}-${v.max}`);
  });

  try {
    console.log("STARTING API CALL TO OPENAI");
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: "system",
          content: `You are a precise JavaScript code generator that creates functions to evaluate mathematical formulas.
                  You MUST include ALL input variables in your calculations.
                  Return ONLY the function code without any explanations or markdown.`
        }, {
          role: "user",
          content: `
            Create a JavaScript function that evaluates this exact formula: ${formula}
            
            Input variables: ${inputVars.join(', ')}
            Output variables to calculate: ${outputVars.join(', ')}
            
            IMPORTANT: 
            - You MUST use ALL the input variables listed above
            - Use simple variable names without special characters, accessed with dot notation like variables.a
            - For Fitts' Law (T = a + b log₂(2D/W)), the correct implementation would be:
              T = variables.a + variables.b * Math.log2(2 * variables.D / variables.W)
            
            Requirements:
            1. Function must be named 'evaluate'
            2. Must take a single parameter 'variables' containing input values as properties
            3. Must use ALL specified input variables with 'variables.symbol' notation
            4. Must return an object with all output variables as properties: { T: value }
            5. Include proper error handling for division by zero and invalid operations
            
            Here's the exact structure to follow:
            
            function evaluate(variables) {
              try {
                // Your calculation code here using ALL input variables
                // Use variables.a, variables.b, etc. for all inputs
                
                return {
                  ${outputVars.map(v => v.replace(/\$/g, '')).join(': calculatedValue, ')}${outputVars.length > 1 ? '' : ': calculatedValue'}
                };
              } catch (error) {
                console.error("Error in formula calculation:", error);
                return {
                  ${outputVars.map(v => v.replace(/\$/g, '')).join(': NaN, ')}${outputVars.length > 1 ? '' : ': NaN'}
                };
              }
            }
          `
        }],
        temperature
      })
    });

    console.log("API CALL COMPLETED");

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OPENAI API ERROR:", errorData);
      throw new Error(`API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    console.log("PARSING RESPONSE");
    const result = await response.json();
    const generatedCode = result.choices[0].message.content.trim();
    
    // Simplified logging - no styling or emojis
    console.log("GENERATED FUNCTION CODE:");
    console.log(generatedCode);
    console.log("END OF GENERATED CODE");
    
    // Validate the code
    if (!generatedCode.includes('function evaluate')) {
      console.error("VALIDATION ERROR: Generated code does not contain evaluate function");
      throw new Error("Generated code does not contain evaluate function");
    }

    // Validate all input vars are used
    for (const inputVar of inputVars) {
      const cleanVar = cleanSymbol(inputVar);
      if (!generatedCode.includes(`variables.${cleanVar}`)) {
        console.warn(`WARNING: Generated code not using input variable: ${inputVar}`);
      }
    }

    // Validate all output vars are calculated
    for (const outputVar of outputVars) {
      const cleanVar = cleanSymbol(outputVar);
      if (!generatedCode.includes(`${cleanVar}:`)) {
        console.error(`VALIDATION ERROR: Generated code missing output variable: ${outputVar}`);
        throw new Error(`Generated code missing output variable: ${outputVar}`);
      }
    }

    // Create the actual function from the code
    console.log("COMPILING FUNCTION");
    
    // Attempt to compile the function to check for syntax errors
    try {
      new Function('variables', `"use strict";\n${generatedCode}\nreturn evaluate(variables);`);
    } catch (compileError: unknown) {
      console.error("VALIDATION ERROR: Generated code has syntax errors:", compileError);
      throw new Error(`Generated code has syntax errors: ${compileError instanceof Error ? compileError.message : String(compileError)}`);
    }

    console.log("FUNCTION GENERATION COMPLETE");
    
    // Create the actual function from the code
    const evaluationFunction = new Function(
      'variables',
      `"use strict";\n${generatedCode}\nreturn evaluate(variables);`
    ) as (variables: Record<string, number>) => Record<string, number>;
    
    return {
      code: generatedCode,
      evaluationFunction
    };
  } catch (error) {
    console.error("❌ ERROR IN FUNCTION GENERATION:", error);
    throw error;
  }
}

/**
 * Execute an evaluation function with variable values
 * @param evaluationFunction The function to execute
 * @param variables Variable definitions with values
 * @returns Object with computed output values
 */
export function executeEvaluationFunction(
  evaluationFunction: (variables: Record<string, number>) => Record<string, number>,
  variables: VariableDefinition[]
): Record<string, number> {
  try {
    // Create a simple object with input variable values
    const values: Record<string, number> = {};
    for (const variable of variables) {
      if (variable.type !== 'output') {
        // Remove dollar signs from variable names to match the function expectations
        const cleanVarName = cleanSymbol(variable.symbol);
        values[cleanVarName] = variable.value;
      }
    }
    
    console.log("Executing function with transformed input values:", values);
    
    // Call the evaluation function
    const result = evaluationFunction(values);
    
    console.log("Raw calculation result:", result);
    
    // Transform the result keys back to match the original variable symbols
    const transformedResult: Record<string, number> = {};
    for (const outputVar of variables.filter(v => v.type === 'output')) {
      const cleanVarName = cleanSymbol(outputVar.symbol);
      if (result[cleanVarName] !== undefined) {
        transformedResult[outputVar.symbol] = result[cleanVarName];
      }
    }
    
    console.log("Transformed result with original symbols:", transformedResult);
    return transformedResult;
  } catch (error) {
    console.error("❌ ERROR IN FUNCTION EXECUTION:", error);
    throw error;
  }
} 
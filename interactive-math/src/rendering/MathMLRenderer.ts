import { latexToMathML } from '../core/FormulaTree';

/**
 * Class for rendering formulas directly using MathML
 */
export class MathMLRenderer {
  /**
   * Check if the browser supports MathML
   * @returns True if MathML is supported
   */
  public static isMathMLSupported(): boolean {
    try {
      // Create a test MathML element
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.visibility = 'hidden';
      div.innerHTML = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi>x</mi></mrow></math>';
      document.body.appendChild(div);
      
      // Check if MathML rendered properly
      const mathElement = div.querySelector('math');
      const supported = 
        mathElement !== null && 
        mathElement.getBoundingClientRect().width > 0;
      
      document.body.removeChild(div);
      return supported;
    } catch (e) {
      return false;
    }
  }

  /**
   * Initialize the renderer
   * @returns Promise that resolves when initialized
   */
  public async initialize(): Promise<void> {
    if (!MathMLRenderer.isMathMLSupported()) {
      throw new Error('MathML is not supported in this browser');
    }
    
    // Nothing to initialize for native MathML
    return Promise.resolve();
  }

  /**
   * Render a LaTeX formula with variable values
   * @param container HTML element to render into
   * @param latex LaTeX formula
   * @param variables Map of variable symbols to their rendered values
   * @returns Promise that resolves when rendering is complete
   */
  public async render(
    container: HTMLElement,
    latex: string,
    variables?: Record<string, { value: number; type: string; units?: string }>
  ): Promise<void> {
    // Process the LaTeX to include variable values
    const processedLatex = variables ? this.processLatexWithVariables(latex, variables) : latex;
    
    try {
      // Convert processed LaTeX to MathML
      const mathml = latexToMathML(processedLatex);
      
      // Clear previous content and render
      container.innerHTML = mathml;
      
      // Add CSS classes to the container
      container.classList.add('interactive-math-container');
      
      // Create a style element if needed for styling
      this.ensureStylesExist();
    } catch (error) {
      console.error('Error rendering formula with MathML:', error);
      throw error;
    }
  }
  
  /**
   * Process LaTeX by replacing variable references with their values
   * @param latex Original LaTeX formula
   * @param variables Map of variables to their values
   * @returns Processed LaTeX
   */
  private processLatexWithVariables(
    latex: string,
    variables: Record<string, { value: number; type: string; units?: string }>
  ): string {
    // Similar implementation as MathJaxRenderer
    let processed = latex;
    
    for (const [symbol, info] of Object.entries(variables)) {
      const cleanSymbol = symbol.replace(/^\$|\$$/g, ''); // Remove $ if present
      
      if (info.type === 'constant') {
        // Replace symbols with their values for constants
        const regex = new RegExp(`\\b${cleanSymbol}\\b`, 'g');
        processed = processed.replace(regex, info.value.toString());
      } else if (info.type === 'input' || info.type === 'output') {
        // For MathML we'll use a simpler approach initially
        // We'll replace the variable with its value and add a class in the MathML
        const regex = new RegExp(`\\b${cleanSymbol}\\b`, 'g');
        const valueText = info.units 
          ? `${info.value}${info.units}`
          : `${info.value}`;
          
        processed = processed.replace(regex, valueText);
      }
    }
    
    return processed;
  }
  
  /**
   * Ensure necessary CSS styles are added to the document
   */
  private ensureStylesExist(): void {
    const styleId = 'interactive-math-styles';
    if (document.getElementById(styleId)) {
      return;
    }
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .interactive-math-container {
        display: flex;
        justify-content: center;
        padding: 1rem;
      }
      
      .interactive-math-container math {
        font-size: 1.2rem;
      }
      
      .interactive-var-input {
        cursor: ns-resize;
        color: #2563eb;
        background-color: rgba(219, 234, 254, 0.3);
        padding: 0.1em 0.2em;
        border-radius: 0.2em;
      }
      
      .interactive-var-output {
        color: #059669;
        background-color: rgba(209, 250, 229, 0.3);
        padding: 0.1em 0.2em;
        border-radius: 0.2em;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  /**
   * Set up interactive behavior for variables
   * @param container HTML element containing the rendered formula
   * @param onVariableChange Callback for when variables change
   */
  public setupInteractivity(
    container: HTMLElement,
    onVariableChange: (symbol: string, value: number) => void
  ): void {
    // MathML interactivity is more challenging
    // This is a simplified implementation
    const inputElements = container.querySelectorAll('.interactive-var-input');
    
    inputElements.forEach((element) => {
      // Set up dragging behavior
      element.addEventListener('mousedown', (e) => {
        if (!(e instanceof MouseEvent)) return;
        
        // Get the variable ID
        const varId = element.getAttribute('data-var');
        if (!varId) return;
        
        const variable = `$${varId}$`;
        const startY = e.clientY;
        const startValue = parseFloat(element.textContent || '0');
        const sensitivity = 0.5;
        
        const handleMouseMove = (moveEvent: MouseEvent) => {
          const deltaY = startY - moveEvent.clientY;
          const newValue = startValue + deltaY * sensitivity;
          onVariableChange(variable, newValue);
        };
        
        const handleMouseUp = () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        e.preventDefault();
      });
    });
  }
} 
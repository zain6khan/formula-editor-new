import { MathJaxRenderer } from './MathJaxRenderer';
import { MathMLRenderer } from './MathMLRenderer';

/**
 * Interface that all renderers must implement
 */
export interface FormulaRenderer {
  /**
   * Initialize the renderer
   * @returns Promise that resolves when initialized
   */
  initialize(): Promise<void>;
  
  /**
   * Render a formula
   * @param container HTML element to render into
   * @param latex LaTeX formula
   * @param variables Map of variable symbols to their rendered values
   * @returns Promise that resolves when rendering is complete
   */
  render(
    container: HTMLElement,
    latex: string,
    variables?: Record<string, { value: number; type: string; units?: string }>
  ): Promise<void>;
  
  /**
   * Set up interactive behavior for variables
   * @param container HTML element containing the rendered formula
   * @param onVariableChange Callback for when variables change
   */
  setupInteractivity(
    container: HTMLElement,
    onVariableChange: (symbol: string, value: number) => void
  ): void;
}

/**
 * Supported rendering backends
 */
export type RendererType = 'mathjax' | 'mathml' | 'auto';

/**
 * Factory for creating formula renderers
 */
export class RendererFactory {
  private static mathJaxRenderer: MathJaxRenderer | null = null;
  private static mathMLRenderer: MathMLRenderer | null = null;
  
  /**
   * Get a renderer instance of the specified type
   * @param type Type of renderer to create
   * @returns A formula renderer
   */
  public static getRenderer(type: RendererType = 'auto'): FormulaRenderer {
    // If auto, try to determine the best renderer
    if (type === 'auto') {
      if (MathMLRenderer.isMathMLSupported()) {
        return RendererFactory.getMathMLRenderer();
      } else {
        return RendererFactory.getMathJaxRenderer();
      }
    }
    
    // Otherwise create the specific renderer
    if (type === 'mathml') {
      return RendererFactory.getMathMLRenderer();
    } else {
      return RendererFactory.getMathJaxRenderer();
    }
  }
  
  /**
   * Get a MathJax renderer instance
   * @returns MathJax renderer
   */
  private static getMathJaxRenderer(): MathJaxRenderer {
    if (!this.mathJaxRenderer) {
      this.mathJaxRenderer = new MathJaxRenderer();
    }
    return this.mathJaxRenderer;
  }
  
  /**
   * Get a MathML renderer instance
   * @returns MathML renderer
   */
  private static getMathMLRenderer(): MathMLRenderer {
    if (!this.mathMLRenderer) {
      this.mathMLRenderer = new MathMLRenderer();
    }
    return this.mathMLRenderer;
  }
} 
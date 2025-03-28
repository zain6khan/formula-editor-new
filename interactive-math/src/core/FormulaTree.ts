/**
 * FormulaTree.ts
 * 
 * This file defines the tree structure for representing mathematical formulas.
 * It provides classes for different types of formula nodes that can be used
 * to build a complete formula tree.
 */

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
 * Base interface that all formula nodes implement
 */
export interface AugmentedFormulaNode {
  /**
   * Convert node to LaTeX string
   */
  toLatex(mode?: string): string;
  
  /**
   * Convert node to MathML
   */
  toMathML(): string;
  
  /**
   * Check if this node equals another
   */
  equals(other: AugmentedFormulaNode): boolean;
  
  /**
   * Get all child nodes
   */
  get children(): AugmentedFormulaNode[];
  
  /**
   * Convert to styled ranges for rendering
   */
  toStyledRanges(): FormulaLatexRanges;
}

/**
 * Main class representing a parsed formula with its AST representation
 */
export class AugmentedFormula {
  /**
   * Creates a new formula with the given child nodes
   */
  constructor(public readonly children: AugmentedFormulaNode[]) {}

  /**
   * Generate LaTeX representation of the formula
   */
  toLatex(mode?: string): string {
    return this.children.map(child => child.toLatex(mode)).join('');
  }

  /**
   * Find a node by its ID - placeholder for future implementation
   */
  findNode(id: string): AugmentedFormulaNode | null {
    return null; // Will be implemented with proper ID tracking
  }

  /**
   * Check if this formula is equal to another
   */
  equals(other: AugmentedFormula): boolean {
    if (this.children.length !== other.children.length) return false;
    
    for (let i = 0; i < this.children.length; i++) {
      if (!this.children[i].equals(other.children[i])) return false;
    }
    
    return true;
  }

  /**
   * Convert formula to styled ranges for rendering/editing
   */
  toStyledRanges(): FormulaLatexRanges {
    return {
      ranges: this.children.flatMap(child => {
        const result = child.toStyledRanges().ranges;
        return result;
      })
    };
  }

  /**
   * Convert formula to MathML format
   */
  toMathML(): string {
    return `<math xmlns="http://www.w3.org/1998/Math/MathML">
      <mrow>${this.children.map(child => child.toMathML()).join('')}</mrow>
    </math>`;
  }
}

/**
 * Represents a script node (subscript/superscript)
 */
export class Script implements AugmentedFormulaNode {
  /**
   * Creates a new script (subscript/superscript) node
   */
  constructor(
    public readonly base: AugmentedFormulaNode,
    public readonly sub?: AugmentedFormulaNode,
    public readonly sup?: AugmentedFormulaNode
  ) {}

  /**
   * Convert to LaTeX representation
   */
  toLatex(mode?: string): string {
    let result = this.base.toLatex(mode);
    
    if (this.sub && this.sup) {
      result += `_{${this.sub.toLatex(mode)}}^{${this.sup.toLatex(mode)}}`;
    } else if (this.sub) {
      result += `_{${this.sub.toLatex(mode)}}`;
    } else if (this.sup) {
      result += `^{${this.sup.toLatex(mode)}}`;
    }
    
    return result;
  }

  /**
   * Get child nodes
   */
  get children(): AugmentedFormulaNode[] {
    const result: AugmentedFormulaNode[] = [this.base];
    if (this.sub) result.push(this.sub);
    if (this.sup) result.push(this.sup);
    return result;
  }

  /**
   * Convert to styled ranges
   */
  toStyledRanges(): FormulaLatexRanges {
    const baseRanges = this.base.toStyledRanges().ranges;
    const subRanges = this.sub ? this.sub.toStyledRanges().ranges : [];
    const supRanges = this.sup ? this.sup.toStyledRanges().ranges : [];

    // Logic for combining ranges would go here
    // Simplified version for now
    return {
      ranges: [
        ...baseRanges,
        ...subRanges,
        ...supRanges
      ]
    };
  }

  /**
   * Check equality with another node
   */
  equals(other: AugmentedFormulaNode): boolean {
    if (!(other instanceof Script)) return false;
    
    const subEqual = (!this.sub && !other.sub) || 
                     (this.sub && other.sub && this.sub.equals(other.sub));
                     
    const supEqual = (!this.sup && !other.sup) || 
                     (this.sup && other.sup && this.sup.equals(other.sup));
    
    return Boolean(this.base.equals(other.base) && subEqual && supEqual);
  }

  /**
   * Convert to MathML
   */
  toMathML(): string {
    if (this.sub && this.sup) {
      return `<msubsup>${this.base.toMathML()}${this.sub.toMathML()}${this.sup.toMathML()}</msubsup>`;
    } else if (this.sub) {
      return `<msub>${this.base.toMathML()}${this.sub.toMathML()}</msub>`;
    } else if (this.sup) {
      return `<msup>${this.base.toMathML()}${this.sup.toMathML()}</msup>`;
    } else {
      return this.base.toMathML();
    }
  }
}

/**
 * Represents a fraction node
 */
export class Fraction implements AugmentedFormulaNode {
  /**
   * Creates a new fraction node
   */
  constructor(
    public readonly numerator: AugmentedFormulaNode,
    public readonly denominator: AugmentedFormulaNode
  ) {}

  /**
   * Convert to LaTeX representation
   */
  toLatex(mode?: string): string {
    return `\\frac{${this.numerator.toLatex(mode)}}{${this.denominator.toLatex(mode)}}`;
  }

  /**
   * Get child nodes
   */
  get children(): AugmentedFormulaNode[] {
    return [this.numerator, this.denominator];
  }

  /**
   * Convert to styled ranges
   */
  toStyledRanges(): FormulaLatexRanges {
    const numerRanges = this.numerator.toStyledRanges().ranges;
    const denomRanges = this.denominator.toStyledRanges().ranges;
    
    // Logic for combining ranges would go here
    // Simplified version for now
    return {
      ranges: [
        ...numerRanges,
        ...denomRanges
      ]
    };
  }

  /**
   * Check equality with another node
   */
  equals(other: AugmentedFormulaNode): boolean {
    if (!(other instanceof Fraction)) return false;
    
    return this.numerator.equals(other.numerator) && 
           this.denominator.equals(other.denominator);
  }

  /**
   * Convert to MathML
   */
  toMathML(): string {
    return `<mfrac>${this.numerator.toMathML()}${this.denominator.toMathML()}</mfrac>`;
  }
}

/**
 * Represents a mathematical symbol
 */
export class MathSymbol implements AugmentedFormulaNode {
  /**
   * Creates a new mathematical symbol node
   */
  constructor(
    public readonly value: string // LaTeX symbol (e.g. "x", "\pi")
  ) {}

  /**
   * Convert to LaTeX representation
   */
  toLatex(mode?: string): string {
    return this.value;
  }

  /**
   * Get child nodes (always empty for symbols)
   */
  get children(): AugmentedFormulaNode[] {
    return [];
  }

  /**
   * Convert to styled ranges
   */
  toStyledRanges(): FormulaLatexRanges {
    return {
      ranges: [{
        start: 0,
        end: this.value.length
      }]
    };
  }

  /**
   * Check equality with another node
   */
  equals(other: AugmentedFormulaNode): boolean {
    if (!(other instanceof MathSymbol)) return false;
    return this.value === other.value;
  }

  /**
   * Convert to MathML
   */
  toMathML(): string {
    // Handle common mathematical symbols
    if (this.value === '\\pi') return '<mi>π</mi>';
    if (this.value === '\\alpha') return '<mi>α</mi>';
    if (this.value === '\\beta') return '<mi>β</mi>';
    if (this.value === '\\gamma') return '<mi>γ</mi>';
    if (this.value === '\\delta') return '<mi>δ</mi>';
    
    // For regular variables
    if (this.value.match(/^[a-zA-Z]$/)) {
      return `<mi>${this.value}</mi>`;
    }
    
    // For numbers
    if (this.value.match(/^\d+(\.\d+)?$/)) {
      return `<mn>${this.value}</mn>`;
    }
    
    // For operators
    const operatorMap: {[key: string]: string} = {
      '+': '+',
      '-': '−',
      '\\times': '×',
      '\\div': '÷',
      '=': '='
    };
    
    if (operatorMap[this.value]) {
      return `<mo>${operatorMap[this.value]}</mo>`;
    }
    
    // Default fallback
    return `<mtext>${this.value}</mtext>`;
  }
}

/**
 * Represents plain text in a formula
 */
export class Text implements AugmentedFormulaNode {
  /**
   * Creates a new text node
   */
  constructor(
    public readonly content: string,
    public readonly isNumberOrIdentifier: boolean = false
  ) {}

  /**
   * Convert to LaTeX representation
   */
  toLatex(mode?: string): string {
    return this.content;
  }

  /**
   * Convert to MathML
   */
  toMathML(): string {
    if (this.isNumberOrIdentifier) {
      if (/^[0-9]+$/.test(this.content)) {
        return `<mn>${this.content}</mn>`;
      } else {
        return `<mi>${this.content}</mi>`;
      }
    }
    return `<mtext>${this.content}</mtext>`;
  }

  /**
   * Check equality with another node
   */
  equals(other: AugmentedFormulaNode): boolean {
    if (!(other instanceof Text)) return false;
    
    return this.content === other.content && 
           this.isNumberOrIdentifier === other.isNumberOrIdentifier;
  }

  /**
   * Convert to styled ranges
   */
  toStyledRanges(): FormulaLatexRanges {
    return {
      ranges: [{
        start: 0,
        end: this.content.length
      }]
    };
  }

  /**
   * Get child nodes (always empty for text)
   */
  get children(): AugmentedFormulaNode[] {
    return [];
  }
}

/**
 * Function to create an AugmentedFormula from a LaTeX string
 * @param latex The LaTeX string to parse
 * @returns AugmentedFormula
 */
export function parseLatexToFormula(latex: string): AugmentedFormula {
  // Placeholder - this will need to be implemented using a proper LaTeX parser
  // For now, we'll return a simple formula with the text as a single node
  return new AugmentedFormula([
    new Text(latex, false)
  ]);
}

/**
 * Converts a LaTeX formula to MathML representation
 * @param latex The LaTeX formula
 * @returns MathML string
 */
export function latexToMathML(latex: string): string {
  const formula = parseLatexToFormula(latex);
  return formula.toMathML();
} 
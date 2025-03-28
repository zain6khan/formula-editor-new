/**
 * Represents a styled or unstyled range in a formula text representation
 */
export type FormulaLatexRangeNode = StyledRange | UnstyledRange;

/**
 * Represents a change to the content of a formula text
 */
export type ContentChange =
  | {
      type: "delete";
      from: number;
      to: number;
    }
  | {
      type: "insert";
      from: number;
      to: number;
      inserted: string;
    };

/**
 * Class representing a formula as a series of styled and unstyled ranges
 */
export class FormulaLatexRanges {
  constructor(public ranges: FormulaLatexRangeNode[]) {
    this.ranges = this.combineUnstyledRanges(ranges);
  }

  /**
   * Combines adjacent unstyled ranges for efficiency
   */
  private combineUnstyledRanges(
    ranges: FormulaLatexRangeNode[]
  ): FormulaLatexRangeNode[] {
    // Combine adjacent UnstyledRanges
    return ranges.reduce((acc, range) => {
      if (range instanceof StyledRange) {
        // Recurse into StyledRange children
        acc.push(
          new StyledRange(
            range.id,
            range.left,
            this.combineUnstyledRanges(range.children),
            range.right,
            range.hints
          )
        );
      } else if (
        acc.length > 0 &&
        acc[acc.length - 1] instanceof UnstyledRange &&
        range instanceof UnstyledRange
      ) {
        // Combine adjacent UnstyledRanges
        acc[acc.length - 1] = new UnstyledRange(
          (acc[acc.length - 1] as UnstyledRange).text + range.text
        );
      } else {
        // Append the next range without combining
        acc.push(range);
      }
      return acc;
    }, [] as FormulaLatexRangeNode[]);
  }

  /**
   * Get ranges containing a specific position
   */
  public getPositionRanges(
    position: number,
    includeEdges: boolean = false
  ): FormulaLatexRangeNode[] {
    const containingRanges: FormulaLatexRangeNode[] = [];

    const findPosition = (
      range: FormulaLatexRangeNode,
      offset: number,
      position: number
    ): [boolean, number] => {
      if (range instanceof UnstyledRange) {
        if (
          (position > offset && position < offset + range.length) ||
          (includeEdges &&
            (position === offset || position === offset + range.length))
        ) {
          containingRanges.push(range);
          return [true, offset + range.length];
        } else {
          return [false, offset + range.length];
        }
      } else {
        const baseOffset = offset;
        let inChildren = false;
        for (const child of range.children) {
          const [found, newOffset] = findPosition(child, offset, position);
          offset = newOffset;
          inChildren ||= found;
        }
        if (inChildren) {
          containingRanges.push(range);
          return [true, offset];
        }

        // When not including edges, we might have skipped the position because
        // it's at the edge of a child range
        if (
          (position > baseOffset && position < offset) ||
          (includeEdges && (position === baseOffset || position === offset))
        ) {
          containingRanges.push(range);
          return [true, offset];
        } else {
          return [false, offset];
        }
      }
    };

    let offset = 0;
    for (const range of this.ranges) {
      const [_, newOffset] = findPosition(range, offset, position);
      offset = newOffset;
    }

    return containingRanges.reverse();
  }

  /**
   * Convert the range representation to LaTeX
   */
  public toLatex(): string {
    return this.ranges.map((range) => range.toLatex()).join("");
  }

  /**
   * Create a new FormulaLatexRanges with a content change applied
   */
  public withContentChange(
    change: ContentChange,
    activeRanges: Set<string>
  ): FormulaLatexRanges {
    const newRanges: FormulaLatexRangeNode[] = [];

    const modifyRange = (
      range: FormulaLatexRangeNode,
      change: ContentChange | null,
      offset: number
    ): [FormulaLatexRangeNode[], ContentChange | null, number] => {
      if (change === null) {
        return [[range], null, offset + range.length];
      }

      if (range instanceof UnstyledRange) {
        if (change.to <= offset || offset + range.length <= change.from) {
          // Change is completely outside of this node's range
          return [[range], change, offset + range.length];
        }

        if (change.type === "delete") {
          const left = range.text.substring(0, change.from - offset);
          const right = range.text.substring(change.to - offset);
          // TODO: Should check if the deletion is completely contained in this range
          return [
            [new UnstyledRange(left + right)],
            null,
            offset + range.length,
          ];
        } else {
          const left = range.text.substring(0, change.from - offset);
          const right = range.text.substring(change.from - offset);
          return [
            [new UnstyledRange(left + change.inserted + right)],
            null,
            offset + range.length,
          ];
        }
      } else {
        if (
          change.type === "insert" &&
          change.from === offset &&
          activeRanges.has(range.id) &&
          range.children.every(
            (child) =>
              child instanceof UnstyledRange || !activeRanges.has(child.id)
          )
        ) {
          // The change is an insert at the left edge of this styled range
          const leftChild = range.children[0];
          const endOffset =
            offset +
            range.children.reduce((acc, child) => acc + child.length, 0);
          if (leftChild instanceof UnstyledRange) {
            // If the left child is already an unstyled range, we can just modify it
            const newChild = new UnstyledRange(
              change.inserted + leftChild.text
            );
            return [
              [
                new StyledRange(
                  range.id,
                  range.left,
                  [newChild, ...range.children.slice(1)],
                  range.right,
                  range.hints
                ),
              ],
              null,
              endOffset,
            ];
          } else {
            // Otherwise, we need to add a new unstyled range to the left of the left child
            const newChild = new UnstyledRange(change.inserted);
            return [
              [
                new StyledRange(
                  range.id,
                  range.left,
                  [newChild, ...range.children],
                  range.right,
                  range.hints
                ),
              ],
              null,
              endOffset,
            ];
          }
        } else if (
          change.type === "insert" &&
          change.from === offset &&
          !activeRanges.has(range.id)
        ) {
          // Left edge of inactive range
          return [
            [new UnstyledRange(change.inserted), range],
            null,
            offset +
              range.children.reduce((acc, child) => acc + child.length, 0),
          ];
        }

        // Apply changes to children
        const newChildren: FormulaLatexRangeNode[] = [];
        let childOffset = offset;
        let currentChange: ContentChange | null = change;

        for (const child of range.children) {
          const [newChildRanges, newChange, newOffset] = modifyRange(
            child,
            currentChange,
            childOffset
          );
          newChildren.push(...newChildRanges);
          childOffset = newOffset;
          currentChange = newChange;
        }

        const result = new StyledRange(
          range.id,
          range.left,
          newChildren,
          range.right,
          range.hints
        );

        return [[result], currentChange, childOffset];
      }
    };

    let offset = 0;
    // Initialize currentChange as ContentChange, but it could become null
    let currentChange: ContentChange | null = change;

    for (const range of this.ranges) {
      const [newRangesForRange, newChange, newOffset] = modifyRange(
        range,
        currentChange,
        offset
      );
      newRanges.push(...newRangesForRange);
      offset = newOffset;
      currentChange = newChange;
    }

    return new FormulaLatexRanges(newRanges);
  }
}

/**
 * Class representing a styled range in a formula
 */
export class StyledRange {
  constructor(
    public id: string,
    public left: string,
    public children: FormulaLatexRangeNode[],
    public right: string,
    public hints?: {
      color?: string;
      tooltip?: string;
      noMark?: boolean;
    }
  ) {}

  /**
   * Get the total length of this range
   */
  public get length(): number {
    return (
      this.left.length +
      this.children.reduce((acc, child) => acc + child.length, 0) +
      this.right.length
    );
  }

  /**
   * Check if this range is equal to another
   */
  public equals(other: FormulaLatexRangeNode): boolean {
    return (
      other instanceof StyledRange &&
      this.id === other.id &&
      this.left === other.left &&
      this.right === other.right &&
      this.children.length === other.children.length &&
      this.children.every((child, i) => child.equals(other.children[i]))
    );
  }

  /**
   * Convert this range to LaTeX
   */
  public toLatex(): string {
    return (
      this.left +
      this.children.map((child) => child.toLatex()).join("") +
      this.right
    );
  }
}

/**
 * Class representing an unstyled text range in a formula
 */
export class UnstyledRange {
  constructor(public text: string) {}

  /**
   * Get the length of this range
   */
  public get length(): number {
    return this.text.length;
  }

  /**
   * Check if this range is equal to another
   */
  public equals(other: FormulaLatexRangeNode): boolean {
    return other instanceof UnstyledRange && this.text === other.text;
  }

  /**
   * Convert this range to LaTeX
   */
  public toLatex(): string {
    return this.text;
  }
} 
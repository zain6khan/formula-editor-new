# Interactive Math Library

A TypeScript library for creating interactive mathematical formulas with LaTeX support. This library enables the creation of educational tools where users can manipulate variables in mathematical equations and see the results in real-time.

## Features

- 📝 Parse and display LaTeX formulas
- 🧮 Handle interactive variables within equations
- 📊 Evaluate mathematical expressions with user-defined values
- 🎨 Render beautiful mathematical expressions with MathJax
- 🔄 React to changes in variable values in real-time
- 📏 Support for units and proper rounding of values
- 🔍 Tooltip support for additional context on variables

## Installation

```bash
npm install interactive-math
```

## Quick Start

```typescript
import { defineEquation } from 'interactive-math';

// Define an interactive equation
const equation = defineEquation({
  formula: "E = mc^2",
  variables: {
    "$m$": { type: "input", range: [0, 10], value: 1, units: "kg" },
    "$c$": { type: "constant", value: 299792458, units: "m/s" },
    "$E$": { type: "output", units: "J" }
  }
});

// Render to a container
equation.renderTo(document.getElementById('formula-container'));

// Listen for changes
equation.onChange((values) => {
  console.log('Energy:', values.$E$);
});
```

## Examples

The library includes several examples that demonstrate its capabilities:

1. **Basic Usage**: A simple example demonstrating Fitts' Law with interactive variables.
2. **Advanced Usage**: Multiple interdependent equations and unit conversions.
3. **Function Graphing**: Interactive function graphs with adjustable parameters.

To run the examples:

```bash
# Build the library
npm run build

# Start the server
npm run serve

# Open in browser
open http://localhost:3000/examples/
```

## API Reference

### `defineEquation(options: EquationOptions): InteractiveEquation`

Creates a new interactive equation instance.

#### EquationOptions

- `formula` (string): The LaTeX formula string
- `variables` (object): Configuration for variables
- `renderer` (optional): Preferred rendering backend ('mathjax' or 'katex')

#### Variable Configuration

- `type`: 'input', 'output', or 'constant'
- `value`: Initial value
- `range`: For input variables, the min and max values
- `round`: Number of decimal places to round to
- `units`: Optional units string
- `tooltip`: Optional tooltip text

### InteractiveEquation Methods

- `renderTo(container: HTMLElement): Promise<void>`: Render equation to container
- `onChange(callback: (values: Record<string, number>) => void): void`: Register change listener
- `setVariable(name: string, value: number | object): void`: Update variable value
- `getVariableValues(): Record<string, number>`: Get current variable values

## Architecture

The library is structured into several modules:

- **core**: Contains the core components like Formula, Variable, and their interfaces
- **computation**: Contains the computation engine for evaluating mathematical expressions
- **rendering**: Contains renderers for displaying formulas (MathJax, KaTeX)
- **api**: Contains the public API classes like InteractiveEquation

## Development

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Generate documentation
npm run docs

# Development mode (watch for changes)
npm run dev
```

## Browser Support

The library supports all modern browsers:

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

MIT 
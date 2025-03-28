/**
 * Interface for variable information
 */
interface VariableInfo {
  value: number;
  type: string;
  units?: string;
  range?: [number, number];
  precision?: number;
}

/**
 * Interface for MathJax globals available on the window object
 */
interface MathJaxWindow {
  MathJax?: {
    startup: {
      promise: Promise<void>;
      defaultReady: () => void;
    };
    typesetPromise: (elements: HTMLElement[]) => Promise<void>;
    typesetClear: (elements: HTMLElement[]) => void;
  };
}

/**
 * Class for rendering formulas using MathJax
 */
export class MathJaxRenderer {
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  
  /**
   * Initialize MathJax
   * @returns Promise that resolves when MathJax is ready
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log("MathJax already initialized, skipping initialization");
      return Promise.resolve();
    }
    
    if (this.initPromise) {
      console.log("MathJax initialization already in progress, waiting for it to complete");
      return this.initPromise;
    }
    
    console.log("Starting MathJax initialization");
    this.initPromise = new Promise<void>((resolve, reject) => {
      // Check if MathJax is already in the global scope
      const mathJaxWindow = window as unknown as MathJaxWindow;
      
      if (!mathJaxWindow.MathJax) {
        console.log("MathJax not found, loading it dynamically");
        
        // Create a promise to track MathJax loading
        const loadPromise = new Promise<void>((loadResolve) => {
          // Match the MathJax config from main.tsx exactly
          (window as any).MathJax = {
            loader: {
              load: [
                "input/tex",
                "output/chtml",
                "[tex]/html",
                "[tex]/color",
                "[tex]/cancel",
              ],
            },
            tex: {
              packages: { "[+]": ["html", "color", "cancel"] },
            },
            chtml: {
              scale: 2.0,
            },
            startup: {
              pageReady: () => {
                return (window as any).MathJax.startup.defaultPageReady().then(() => {
                  console.log("MathJax is ready via pageReady");
                  loadResolve();
                });
              },
            },
          };

          // Load MathJax script
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
          script.async = true;
          script.onerror = () => reject(new Error("Failed to load MathJax"));
          document.head.appendChild(script);
        });
        
        // Wait for MathJax to be fully loaded and configured
        loadPromise.then(() => {
          this.isInitialized = true;
          console.log("MathJax initialized successfully");
          resolve();
        }).catch(error => {
          console.error("Failed to initialize MathJax:", error);
          reject(error);
        });
      } else {
        console.log("MathJax already available, waiting for startup promise");
        // If MathJax is already available, just wait for it to be ready
        mathJaxWindow.MathJax.startup.promise
          .then(() => {
            this.isInitialized = true;
            console.log("MathJax initialized successfully from existing instance");
            resolve();
          })
          .catch(error => {
            console.error("Failed to initialize MathJax from existing instance:", error);
            reject(error);
          });
      }
    });
    
    return this.initPromise;
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
    variables?: Record<string, { 
      value: number; 
      type: string; 
      units?: string;
      range?: [number, number];
      precision?: number;
    }>
  ): Promise<void> {
    console.log("Render method called with:", { latex, variables });
    await this.initialize();
    
    // Preserve existing state if variables aren't passed
    if (!variables && container.dataset.variables) {
      try {
        variables = JSON.parse(container.dataset.variables);
        console.log("Restored variables from container:", variables);
      } catch (error) {
        console.error("Error parsing variables from container:", error);
      }
    }
    
    // Process the LaTeX to include variable values
    const processedLatex = variables ? this.processLatexWithVariables(latex, variables) : latex;
    
    // Get MathJax with proper type casting
    const mathJax = (window as unknown as MathJaxWindow).MathJax;
    if (!mathJax) {
      throw new Error('MathJax not initialized');
    }
    
    try {
      console.log("Clearing previous MathJax content");
      // Clear previous content
      mathJax.typesetClear([container]);
      
      // Update content and render - use the standard inline math delimiters
      console.log("Setting container innerHTML with processed LaTeX:", processedLatex);
      
      // Create a new container element for MathJax to render into
      container.innerHTML = '';
      const mathContainer = document.createElement('div');
      mathContainer.innerHTML = `\\[${processedLatex}\\]`;
      container.appendChild(mathContainer);
      
      // Add a special class to the container for styling
      container.classList.add('interactive-formula-container');
      
      console.log("Calling MathJax typeset promise");
      await mathJax.typesetPromise([container]);
      console.log("MathJax typeset complete");

      // Add CSS for interactive elements
      this.addInteractiveCSS();
      
      // Store variable information in the container for later use
      if (variables) {
        console.log("Storing variables in container data attribute:", variables);
        container.dataset.variables = JSON.stringify(variables);
      }
    } catch (error) {
      console.error('Error rendering formula:', error);
      throw error;
    }
  }
  
  /**
   * Process LaTeX by replacing variable references with their values
   */
  private processLatexWithVariables(
    latex: string,
    variables: Record<string, { 
      value: number; 
      type: string; 
      units?: string;
      range?: [number, number];
      precision?: number; 
    }>
  ): string {
    console.log("Processing LaTeX with variables:", { latex, variables });
    
    // Simple implementation - for complex formulas this would need to be more robust
    let processed = latex;
    
    // Replace variables with their values and apply proper formatting
    for (const [symbol, info] of Object.entries(variables)) {
      // Remove $ if present when working with the symbol
      const cleanSymbol = symbol.replace(/^\$|\$$/g, '');
      
      // Format the value based on precision
      const formattedValue = info.precision !== undefined
        ? info.value.toFixed(info.precision)
        : info.value.toString();
        
      // Create display text with units
      let display = formattedValue;
      if (info.units) {
        // Use proper LaTeX for units
        display = `${formattedValue}\\,\\mathrm{${info.units}}`;
      }
      
      // Create a regular expression to match the variable
      // Improve regex to better match standalone variables
      const regex = new RegExp(`(^|[^a-zA-Z])(${cleanSymbol})([^a-zA-Z]|$)`, 'g');
      
      // Process variables based on their type
      if (info.type === 'constant') {
        // For constants, just replace with the value
        processed = processed.replace(regex, (match, before, variable, after) => {
          return `${before}${display}${after}`;
        });
      } else if (info.type === 'slideable' || info.type === 'scrubbable') {
        // For interactive variables, use color commands to distinguish them
        const color = info.type === 'scrubbable' ? 'blue' : 'purple';
        processed = processed.replace(regex, (match, before, variable, after) => {
          // Just use color command - avoid nested styling in \bbox
          return `${before}{\\color{${color}}{${variable}: ${display}}}${after}`;
        });
      } else if (info.type === 'output') {
        processed = processed.replace(regex, (match, before, variable, after) => {
          // For output variables, use green color
          return `${before}{\\color{green}{${variable}: ${display}}}${after}`;
        });
      }
      
      // Log what was replaced to help with debugging
      console.log(`Variable replacement for ${cleanSymbol}: type=${info.type}, value=${formattedValue}`);
    }
    
    // Ensure proper handling of \cdot and other LaTeX commands
    processed = processed
      .replace(/\\cdot/g, '\\cdot ')
      .replace(/\\log_2/g, '\\log_2 ');
      
    console.log("Processed LaTeX:", processed);
    return processed;
  }

  /**
   * Add CSS for interactive elements
   */
  private addInteractiveCSS() {
    // Check if our style already exists
    if (document.getElementById('mathJaxRenderer-style')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'mathJaxRenderer-style';
    styleEl.textContent = `
      /* Container styling */
      .interactive-formula-container {
        background-color: white;
        border-radius: 8px;
        padding: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 80px;
        position: relative;
        z-index: 10;
      }
      
      .interactive-formula-container .MathJax {
        font-size: 120% !important;
      }
      
      /* CRITICAL: Ensure pointer events work on all elements */
      .interactive-formula-container * {
        pointer-events: auto !important;
      }
      
      /* Highlight color elements */
      mjx-c[style*="color: blue"], mjx-mtext[style*="color: blue"], mjx-mi[style*="color: blue"] {
        cursor: ns-resize !important;
        transition: opacity 0.2s, background 0.2s !important;
        position: relative !important;
        z-index: 100 !important;
      }
      
      mjx-c[style*="color: blue"]:hover, mjx-mtext[style*="color: blue"]:hover, mjx-mi[style*="color: blue"]:hover {
        background: rgba(0, 100, 255, 0.2) !important;
      }
      
      mjx-c[style*="color: purple"], mjx-mtext[style*="color: purple"], mjx-mi[style*="color: purple"] {
        cursor: ns-resize !important;
        transition: opacity 0.2s, background 0.2s !important;
        position: relative !important;
        z-index: 100 !important;
      }
      
      mjx-c[style*="color: purple"]:hover, mjx-mtext[style*="color: purple"]:hover, mjx-mi[style*="color: purple"]:hover {
        background: rgba(100, 0, 255, 0.2) !important;
      }
      
      mjx-c[style*="color: green"], mjx-mtext[style*="color: green"], mjx-mi[style*="color: green"] {
        font-weight: bold !important;
      }
      
      /* Also handle mstyle and texatom elements */
      mjx-mstyle[style*="color: blue"], mjx-texatom[style*="color: blue"] {
        cursor: ns-resize !important;
        transition: opacity 0.2s, background 0.2s !important;
        position: relative !important;
        z-index: 100 !important;
      }
      
      mjx-mstyle[style*="color: blue"]:hover, mjx-texatom[style*="color: blue"]:hover {
        background: rgba(0, 100, 255, 0.2) !important;
      }
      
      mjx-mstyle[style*="color: purple"], mjx-texatom[style*="color: purple"] {
        cursor: ns-resize !important;
        transition: opacity 0.2s, background 0.2s !important;
        position: relative !important;
        z-index: 100 !important;
      }
      
      mjx-mstyle[style*="color: purple"]:hover, mjx-texatom[style*="color: purple"]:hover {
        background: rgba(100, 0, 255, 0.2) !important;
      }
      
      mjx-mstyle[style*="color: green"], mjx-texatom[style*="color: green"] {
        font-weight: bold !important;
      }
      
      /* Style for mrow elements (often contains the variable) */
      mjx-mrow {
        position: relative;
        z-index: 100 !important;
      }
      
      /* Ensure all interactive elements have proper mouse events */
      [data-interactive="true"] {
        cursor: ns-resize !important;
        z-index: 1000 !important; 
        position: relative !important;
      }
      
      /* Style for tooltip */
      .variable-tooltip {
        position: absolute;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 5px 10px;
        font-family: sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 200;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      
      .variable-tooltip.active {
        opacity: 1;
      }
    `;
    
    document.head.appendChild(styleEl);
  }
  
  /**
   * Setup interactive behavior for variables
   * @param container HTML element containing the rendered formula
   * @param onVariableChange Callback for when variables change
   */
  public setupInteractivity(
    container: HTMLElement,
    onVariableChange: (symbol: string, value: number) => void
  ): void {
    console.log("🔍 Setting up interactivity on container:", container);
    
    // Get the variable information from the container
    const variablesJSON = container.dataset.variables;
    if (!variablesJSON) {
      console.warn("⚠️ No variable information found on container");
      return;
    }
    
    try {
      // Parse variable data
      const variables = JSON.parse(variablesJSON) as Record<string, VariableInfo>;
      console.log("🔍 Parsed variable data:", variables);
      
      // Store original keys that include dollar sign formatting
      const originalSymbols = Object.keys(variables);
      console.log("🔍 Original variable symbols:", originalSymbols);
      
      // First, let's log the entire structure of the MathJax output to understand its structure
      console.log(`🔎 DOM Structure Analysis`);
      console.log(`🔎 Container HTML:`, container.innerHTML.substring(0, 200) + (container.innerHTML.length > 200 ? "..." : ""));

      // Check what variables we're looking for
      console.log(`🔎 Variables to look for:`, Object.keys(variables));

      // Log the datasets to see if they're properly attached
      console.log(`🔎 Container dataset:`, container.dataset);
      
      // Create a tooltip element for displaying values
      const tooltip = document.createElement('div');
      tooltip.className = 'variable-tooltip';
      container.appendChild(tooltip);
      
      // Find MathJax's rendered output
      const mjxOutput = container.querySelector('.MathJax');
      if (!mjxOutput) {
        console.warn("⚠️ Could not find MathJax output in container");
        return;
      }
      
      console.log("🔍 Found MathJax output:", mjxOutput);
      
      // Logging MathJax output for detailed debugging
      this.logMathJaxStructure(mjxOutput as HTMLElement);
      
      // Find all potential interactive elements - try different strategies
      const interactiveElements: HTMLElement[] = [];
      
      // Strategy 1: Find by style attribute with color
      this.findElementsByAttribute(mjxOutput as HTMLElement, '[style*="color: blue"]').forEach(el => {
        if (!interactiveElements.includes(el)) interactiveElements.push(el);
      });
      
      this.findElementsByAttribute(mjxOutput as HTMLElement, '[style*="color: purple"]').forEach(el => {
        if (!interactiveElements.includes(el)) interactiveElements.push(el);
      });
      
      // Strategy 2: Find by specific MathJax tags which might be nested inside styled parents
      ['mjx-mstyle', 'mjx-texatom', 'mjx-mtext', 'mjx-mi', 'mjx-mrow'].forEach(tag => {
        Array.from(mjxOutput.querySelectorAll(tag)).forEach(el => {
          // Check if the element or its parent has a color style
          let currentEl: HTMLElement | null = el as HTMLElement;
          let depth = 0;
          
          while (currentEl && depth < 3) {
            if (currentEl.style && 
                (currentEl.style.color === 'blue' || currentEl.style.color === 'purple')) {
              if (!interactiveElements.includes(currentEl)) {
                interactiveElements.push(currentEl);
              }
              break;
            }
            currentEl = currentEl.parentElement;
            depth++;
          }
        });
      });
      
      // Strategy 3: Look directly for scrubbable/slideable variable patterns in text
      const varPatterns = originalSymbols
        .filter(sym => variables[sym].type === 'scrubbable' || variables[sym].type === 'slideable')
        .map(sym => sym.replace(/^\$|\$$/g, ''));
      
      if (varPatterns.length > 0) {
        console.log(`🔍 Looking for variable patterns:`, varPatterns);
        
        // Find elements containing these variable names
        const allElements = Array.from(mjxOutput.querySelectorAll('*')) as HTMLElement[];
        for (const el of allElements) {
          const text = el.textContent || "";
          
          // Check if the text contains any of our variable patterns
          for (const varPattern of varPatterns) {
            if (text.includes(varPattern) && text.includes(':')) {
              // Found potential match - check if not already included
              if (!interactiveElements.includes(el)) {
                console.log(`🔍 Found possible interactive element by text content: "${text}"`);
                interactiveElements.push(el);
              }
              break;
            }
          }
        }
      }
      
      console.log(`🔍 Found ${interactiveElements.length} potentially interactive elements`);
      
      // Process all found elements
      for (const el of interactiveElements) {
        console.log(`🔍 Processing interactive element:`, {
          tagName: el.tagName,
          className: el.className,
          style: el.getAttribute('style'), 
          textContent: el.textContent?.trim(),
        });
        
        this.trySetupElement(el, variables, originalSymbols, tooltip, onVariableChange);
      }
      
      // Create variable-to-element mapping
      const variableElements = new Map<string, HTMLElement[]>();
      
      // Map variables to their elements
      originalSymbols
        .filter(sym => variables[sym].type === 'scrubbable' || variables[sym].type === 'slideable')
        .forEach(sym => {
          const cleanSym = sym.replace(/^\$|\$$/g, '');
          const elements = Array.from(mjxOutput.querySelectorAll('*'))
            .filter((el: Element) => {
              const text = el.textContent || '';
              return text.includes(cleanSym) && text.includes(':'); 
            }) as HTMLElement[];
            
          if (elements.length > 0) {
            variableElements.set(sym, elements);
            console.log(`🔍 Mapped variable ${sym} to ${elements.length} elements`);
          }
        });
        
      // IMPLEMENT DOCUMENT-LEVEL FALLBACK HANDLER
      // This is a critical addition - it adds a global mousedown handler that works 
      // regardless of event bubbling or capture issues
      console.log(`🔍 Setting up document-level event handler for interactive elements`);
      
      // Remove any existing handlers
      if ((document as any)._mathJaxGlobalHandler) {
        document.removeEventListener('mousedown', (document as any)._mathJaxGlobalHandler, true);
      }
      
      // Variables to track current drag operation
      let activeVariable: string | null = null;
      let activeElement: HTMLElement | null = null;
      let isDragging = false;
      let startY = 0;
      let startValue = 0;
      let sensitivity = 0.05;
      
      // Create global mousedown handler
      const globalMousedownHandler = (e: MouseEvent) => {
        // If already dragging, ignore
        if (isDragging) return;
        
        // Check if we're clicking on an interactive element
        const target = e.target as HTMLElement;
        const formulaContainer = target.closest('.interactive-formula-container');
        
        // Only handle events within our formula container 
        if (!formulaContainer || formulaContainer !== container) return;
        
        console.log(`🖱️ [GLOBAL_MOUSEDOWN] at ${e.clientX},${e.clientY} in formula container`);
        
        // CRITICAL - Extra debug logging to identify the clicked element
        if (target) {
          console.log(`🔬 [CLICK_DEBUG] Clicked on element:`, {
            tag: target.tagName,
            id: target.id,
            class: target.className,
            text: target.textContent?.trim().substring(0, 50),
            rect: target.getBoundingClientRect()
          });
        }
        
        // Look for potential interactive elements
        // First check if we hit an element with a data-variable attribute
        let matchedEl: HTMLElement | null = null;
        let matchedSymbol: string | null = null;
        
        // Method 1: Check for data-variable attribute (most direct and accurate)
        let currentEl: HTMLElement | null = target;
        while (currentEl && !matchedEl) {
          const varAttr = currentEl.getAttribute('data-variable');
          if (varAttr) {
            matchedEl = currentEl;
            matchedSymbol = varAttr;
            console.log(`🖱️ [GLOBAL_MATCH] Found element with data-variable=${varAttr}`);
            break;
          }
          
          // Also check color attribute
          if (currentEl.style && (currentEl.style.color === 'blue' || currentEl.style.color === 'purple')) {
            // Try to identify variable from text content
            const text = currentEl.textContent || '';
            console.log(`🖱️ [GLOBAL_MATCH] Analyzing colored element text: "${text}"`);
            
            // CRITICAL FIX: Enhanced pattern matching with extra strictness for W vs D distinction
            // We need to be extremely precise about finding "W:" vs "D:" in the text
            const strictMatch = text.trim().match(/^([A-Za-z])\s*:\s*([\d\.]+)$/);
            if (strictMatch) {
              const detectedVar = strictMatch[1];
              console.log(`🎯 [PRECISE_MATCH] Found exact variable pattern for "${detectedVar}:" in standalone text`);
              
              // If we found an exact match for W or D, trust it completely
              for (const symbol of originalSymbols) {
                const cleanSymbol = symbol.replace(/^\$|\$$/g, '');
                if (cleanSymbol === detectedVar) {
                  matchedEl = currentEl;
                  matchedSymbol = symbol;
                  console.log(`🎯 [PRECISE_MATCH] Confirmed exact match for ${cleanSymbol}`);
                  // Add data attribute to remember this match
                  currentEl.setAttribute('data-variable', cleanSymbol);
                  break;
                }
              }
            } else {
              // ENHANCED PATTERN MATCHING: Critical for distinguishing between W and D
              // Look for the most precise match possible - a variable followed directly by a colon and a number
              const strictVariableMatch = text.match(/\b([A-Za-z]):\s*([\d\.]+)/);
              if (strictVariableMatch) {
                const detectedVar = strictVariableMatch[1];
                
                // Verify this is a valid variable in our list
                for (const symbol of originalSymbols) {
                  const cleanSymbol = symbol.replace(/^\$|\$$/g, '');
                  if (cleanSymbol === detectedVar) {
                    console.log(`🖱️ [GLOBAL_MATCH] STRICT MATCH found for ${cleanSymbol}: "${text}"`);
                    matchedEl = currentEl;
                    matchedSymbol = symbol;
                    
                    // Explicitly log the actual variable we're identifying this as
                    console.log(`⭐ [VARIABLE_ID] Identified as variable "${cleanSymbol}" from text "${text}"`);
                    break;
                  }
                }
              } else {
                // Try a more general pattern but with word boundaries to avoid partial matches
                for (const symbol of originalSymbols) {
                  const cleanSym = symbol.replace(/^\$|\$$/g, '');
                  
                  // Use very strict word boundary matching to avoid confusion
                  const exactVarPattern = new RegExp(`\\b${cleanSym}\\s*:`, 'i');
                  
                  if (exactVarPattern.test(text)) {
                    console.log(`🖱️ [GLOBAL_MATCH] BOUNDARY MATCH found for ${cleanSym} with pattern ${exactVarPattern}`);
                    matchedEl = currentEl;
                    matchedSymbol = symbol;
                    
                    // Explicitly log the actual variable we're identifying this as
                    console.log(`⭐ [VARIABLE_ID] Identified as variable "${cleanSym}" from pattern match in "${text}"`);
                    break;
                  }
                }
              }
            }
          }
          
          currentEl = currentEl.parentElement;
        }
        
        // Method 2: Search by DOM attributes and position if no direct match
        if (!matchedEl) {
          // Try to find elements with explicit data-variable attributes near the click
          const allElementsWithVar = Array.from(
            formulaContainer.querySelectorAll('[data-variable]')
          ) as HTMLElement[];
          
          // Find the closest element by distance
          let closestDistance = Infinity;
          let closestElement: HTMLElement | null = null;
          
          for (const el of allElementsWithVar) {
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distance = Math.sqrt(
              Math.pow(e.clientX - centerX, 2) + 
              Math.pow(e.clientY - centerY, 2)
            );
            
            if (distance < closestDistance && distance < 30) { // 30px threshold
              closestDistance = distance;
              closestElement = el;
            }
          }
          
          if (closestElement) {
            const varAttr = closestElement.getAttribute('data-variable');
            if (varAttr) {
              matchedEl = closestElement;
              matchedSymbol = varAttr;
              console.log(`🖱️ [GLOBAL_MATCH] Found nearby element with data-variable=${varAttr}, distance=${closestDistance.toFixed(2)}px`);
            }
          }
        }
        
        // Method 3: Spatial matching with colored elements as a last resort
        if (!matchedEl) {
          const blueElements = this.findElementsByAttribute(mjxOutput as HTMLElement, '[style*="color: blue"]');
          const purpleElements = this.findElementsByAttribute(mjxOutput as HTMLElement, '[style*="color: purple"]');
          const allColoredElements = [...blueElements, ...purpleElements];
          
          // Find the closest element by distance
          let closestDistance = Infinity;
          let closestElement: HTMLElement | null = null;
          let closestSymbol: string | null = null;
          
          for (const el of allColoredElements) {
            const rect = el.getBoundingClientRect();
            
            // Check proximity to click (closer than 30px)
            if (e.clientX >= rect.left - 30 && e.clientX <= rect.right + 30 &&
                e.clientY >= rect.top - 30 && e.clientY <= rect.bottom + 30) {
              
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              const distance = Math.sqrt(
                Math.pow(e.clientX - centerX, 2) + 
                Math.pow(e.clientY - centerY, 2)
              );
              
              if (distance < closestDistance) {
                closestDistance = distance;
                closestElement = el;
                
                // Try to detect variable from text context
                const text = el.textContent || '';
                
                // First try exact pattern with value: "W: 1.0"
                const strictMatch = text.match(/\b([A-Za-z]):\s*([\d\.]+)/);
                if (strictMatch) {
                  for (const symbol of originalSymbols) {
                    const cleanSym = symbol.replace(/^\$|\$$/g, '');
                    if (cleanSym === strictMatch[1]) {
                      closestSymbol = symbol;
                      console.log(`🖱️ [SPATIAL_MATCH] Found strict variable match ${cleanSym} in element at distance ${distance.toFixed(2)}px`);
                      break;
                    }
                  }
                } 
                // Then try just the variable with colon
                else {
                  for (const symbol of originalSymbols) {
                    const cleanSym = symbol.replace(/^\$|\$$/g, '');
                    const pattern = new RegExp(`\\b${cleanSym}\\s*:`, 'i');
                    if (pattern.test(text)) {
                      closestSymbol = symbol;
                      console.log(`🖱️ [SPATIAL_MATCH] Found pattern match for ${cleanSym} in element at distance ${distance.toFixed(2)}px`);
                      break;
                    }
                  }
                }
              }
            }
          }
          
          if (closestElement && closestSymbol) {
            matchedEl = closestElement;
            matchedSymbol = closestSymbol;
            console.log(`🖱️ [GLOBAL_MATCH] Using closest element with symbol ${closestSymbol}, distance=${closestDistance.toFixed(2)}px`);
            
            // For visual debugging - add a temporary highlight
            if (closestElement) {
              closestElement.style.outline = '2px solid red';
              setTimeout(() => {
                if (closestElement) {
                  closestElement.style.outline = '';
                }
              }, 2000);
            }
          }
        }
        
        // Final check to ensure we have a valid match
        if (matchedEl && matchedSymbol) {
          // Safety check - make sure the element actually contains the variable text
          const elText = matchedEl.textContent || '';
          const cleanMatchedSymbol = matchedSymbol.replace(/^\$|\$$/g, '');
          
          // CRITICAL FIX: Force check for exact match to avoid W/D confusion
          // This is the most critical part of the fix - ensuring we never mistake W for D or vice versa
          const exactVarText = elText.trim();
          const wExactPattern = /^W\s*:\s*[\d\.]+$/;
          const dExactPattern = /^D\s*:\s*[\d\.]+$/;
          
          // If we're dealing with W or D variables specifically
          if (cleanMatchedSymbol === 'W' || cleanMatchedSymbol === 'D') {
            const isExactW = wExactPattern.test(exactVarText);
            const isExactD = dExactPattern.test(exactVarText);
            
            // If W is claimed but text exactly matches D pattern, or vice versa, reset the match
            if ((cleanMatchedSymbol === 'W' && isExactD && !isExactW) ||
                (cleanMatchedSymbol === 'D' && isExactW && !isExactD)) {
              console.error(`❌ [CRITICAL_MISMATCH] Variable claimed to be ${cleanMatchedSymbol} but text matches other variable!`);
              console.error(`❌ Text: "${exactVarText}" | W match: ${isExactW} | D match: ${isExactD}`);
              
              // Override the mistaken match with the correct variable
              if (isExactW) {
                console.log(`✅ [OVERRIDE] Correcting misidentified variable to W based on exact text match`);
                matchedSymbol = 'W';
                matchedEl.setAttribute('data-variable', 'W');
              } else if (isExactD) {
                console.log(`✅ [OVERRIDE] Correcting misidentified variable to D based on exact text match`);
                matchedSymbol = 'D';
                matchedEl.setAttribute('data-variable', 'D');
              }
            }
          }
          
          // Verify this is REALLY the right variable by checking strict pattern
          const verificationPattern = new RegExp(`\\b${cleanMatchedSymbol}\\s*:`, 'i');
          if (!verificationPattern.test(elText)) {
            console.error(`❌ [VERIFICATION_FAILED] Element text "${elText}" does not clearly contain variable ${cleanMatchedSymbol}`);
            console.error(`❌ Looking for another match...`);
            
            // Try to find a better match by scanning nearby elements
            const betterMatch = this.findBetterVariableMatch(matchedEl, cleanMatchedSymbol);
            if (betterMatch) {
              matchedEl = betterMatch;
              console.log(`✅ [RECOVERY] Found better element with clear text match for ${cleanMatchedSymbol}`);
            } else {
              // If we can't verify, proceed but with a warning
              console.warn(`⚠️ [PROCEEDING] Could not verify variable in element text, but continuing with best guess: ${cleanMatchedSymbol}`);
            }
          }
          
          console.log(`🖱️ [GLOBAL_HANDLER] Starting drag for ${matchedSymbol} on element:`, matchedEl);
          
          // We found a match, now start dragging
          e.preventDefault();
          e.stopPropagation();
          
          // Set up drag operation
          activeVariable = matchedSymbol;
          activeElement = matchedEl;
          isDragging = true;
          startY = e.clientY;
          
          // Get variable info
          const varInfo = variables[matchedSymbol];
          if (!varInfo) {
            console.error(`❌ [GLOBAL_ERROR] No variable info for ${matchedSymbol}`);
            return;
          }
          
          startValue = varInfo.value;
          
          // Calculate sensitivity
          if (varInfo.range) {
            const [min, max] = varInfo.range;
            const range = max - min;
            if (range <= 1) {
              sensitivity = 0.005;
            } else if (range <= 10) {
              sensitivity = 0.02;
            } else {
              sensitivity = range / 200;
            }
          }
          
          // Add visual feedback
          matchedEl.style.opacity = '0.7';
          matchedEl.style.backgroundColor = 'rgba(0, 120, 255, 0.1)';
          
          // Show tooltip
          tooltip.textContent = this.formatValue(matchedSymbol, varInfo);
          tooltip.style.left = `${e.clientX}px`;
          tooltip.style.top = `${e.clientY - 30}px`;
          tooltip.classList.add('active');
          
          console.log(`🖱️ [GLOBAL_DRAG_START] Started dragging ${matchedSymbol}, initial value=${startValue}, sensitivity=${sensitivity}`);
        }
      };
      
      // Create global mousemove handler
      const globalMousemoveHandler = (e: MouseEvent) => {
        if (!isDragging || !activeVariable || !activeElement) return;
        
        console.log(`🖱️ [GLOBAL_MOUSEMOVE] Movement for ${activeVariable} at ${e.clientX},${e.clientY}`);
        
        e.preventDefault();
        e.stopPropagation();
        
        // Calculate new value
        const deltaY = startY - e.clientY;
        let newValue = startValue + deltaY * sensitivity;
        
        // Get variable info
        const varInfo = variables[activeVariable];
        if (!varInfo) return;
        
        // Apply constraints
        if (varInfo.range) {
          const [min, max] = varInfo.range;
          newValue = Math.max(min, Math.min(max, newValue));
        }
        
        // Apply precision
        if (varInfo.precision !== undefined) {
          const factor = Math.pow(10, varInfo.precision);
          newValue = Math.round(newValue * factor) / factor;
        }
        
        // Update only if value changed
        if (newValue !== varInfo.value) {
          console.log(`🖱️ [GLOBAL_VALUE_CHANGE] ${activeVariable}: ${varInfo.value} -> ${newValue}`);
          
          // Update stored value
          varInfo.value = newValue;
          
          // Update tooltip
          tooltip.textContent = this.formatValue(activeVariable, varInfo);
          tooltip.style.left = `${e.clientX}px`;
          tooltip.style.top = `${e.clientY - 30}px`;
          
          // Update DOM
          try {
            // Find elements for this variable
            if (activeElement && activeVariable) {
              const elements = this.findVariableElementsInDOM(activeElement, activeVariable);
              console.log(`🖱️ [GLOBAL_UPDATE] Updating ${elements.length} elements for ${activeVariable}`);
              
              // Update each element
              elements.forEach(el => {
                this.updateElementDisplay(el, activeVariable as string, newValue, varInfo.precision, varInfo.units);
              });
              
              // Update dependent variables UI
              this.updateDependentVariables(newValue, activeVariable);
            }
          } catch (e) {
            console.error(`❌ [GLOBAL_ERROR] Error updating display:`, e);
          }
          
          // ====== API UPDATE THROUGH CALLBACK ======
          // Call the variable change callback with properly formatted symbol
          console.log(`🖱️ [API_CALL] Calling onVariableChange with symbol: ${activeVariable} = ${newValue}`);
          
          // CRITICAL: Call the variable change callback to update the state management system
          onVariableChange(activeVariable, newValue);
        }
      };
      
      // Create global mouseup handler
      const globalMouseupHandler = (e: MouseEvent) => {
        if (!isDragging || !activeVariable || !activeElement) return;
        
        console.log(`🖱️ [GLOBAL_MOUSEUP] Ended drag for ${activeVariable}, final value=${variables[activeVariable]?.value}`);
        
        e.preventDefault();
        e.stopPropagation();
        
        // Clean up
        activeElement.style.opacity = '';
        activeElement.style.backgroundColor = '';
        tooltip.classList.remove('active');
        
        // Force final update
        if (activeVariable) {
          console.log(`🖱️ [GLOBAL_FINAL_UPDATE] ${activeVariable}=${variables[activeVariable]?.value}`);
          onVariableChange(activeVariable, variables[activeVariable]?.value);
        }
        
        // Reset state
        isDragging = false;
        activeVariable = null;
        activeElement = null;
      };
      
      // Register global handlers
      document.addEventListener('mousedown', globalMousedownHandler, true);
      window.addEventListener('mousemove', globalMousemoveHandler, true);
      window.addEventListener('mouseup', globalMouseupHandler, true);
      
      // Store references to remove later if needed
      (document as any)._mathJaxGlobalHandler = globalMousedownHandler;
      (window as any)._mathJaxGlobalMoveHandler = globalMousemoveHandler;
      (window as any)._mathJaxGlobalUpHandler = globalMouseupHandler;
      
      // Setup complete
      console.log(`✅ Interactivity setup complete with global event handlers`);
      
    } catch (error) {
      console.error("❌ Error setting up interactivity:", error);
    }
  }
  
  /**
   * Helper method to find elements by selector, falling back to manual traversal if querySelector fails
   */
  private findElementsByAttribute(root: HTMLElement, selector: string): HTMLElement[] {
    // Try direct selector
    try {
      return Array.from(root.querySelectorAll(selector)) as HTMLElement[];
    } catch (e) {
      console.warn(`⚠️ Selector ${selector} failed, using manual traversal`);
      
      // Fall back to manual traversal
      const results: HTMLElement[] = [];
      const allElements = Array.from(root.querySelectorAll('*')) as HTMLElement[];
      
      for (const el of allElements) {
        // Manual check for color style
        if (el.style && 
            ((selector.includes('blue') && el.style.color === 'blue') ||
             (selector.includes('purple') && el.style.color === 'purple'))) {
          results.push(el);
        }
      }
      
      return results;
    }
  }
  
  /**
   * Log detailed structure of MathJax output for debugging
   */
  private logMathJaxStructure(mjxOutput: HTMLElement): void {
    console.log(`🔎 MathJax output found - element:`, mjxOutput.tagName);
    console.log(`🔎 MathJax content:`, mjxOutput.innerHTML.substring(0, 200) + (mjxOutput.innerHTML.length > 200 ? "..." : ""));
    
    // Log colored elements specifically
    const blueElements = this.findElementsByAttribute(mjxOutput, '[style*="color: blue"]');
    console.log(`🔎 Found ${blueElements.length} blue elements`);
    blueElements.forEach((el, i) => {
      console.log(`🔎 Blue element ${i+1}:`, {
        tag: el.tagName,
        text: el.textContent?.trim(),
        style: el.getAttribute('style'),
        children: el.childNodes.length
      });
    });
    
    const purpleElements = this.findElementsByAttribute(mjxOutput, '[style*="color: purple"]');
    console.log(`🔎 Found ${purpleElements.length} purple elements`);
    purpleElements.forEach((el, i) => {
      console.log(`🔎 Purple element ${i+1}:`, {
        tag: el.tagName,
        text: el.textContent?.trim(),
        style: el.getAttribute('style'),
        children: el.childNodes.length
      });
    });
    
    // Log the structure visualization
    const structure = this.analyzeElement(mjxOutput);
    console.log(`🔎 MathJax structure:`, structure);
  }

  /**
   * Try to set up interactivity for an element or its parent elements
   */
  private trySetupElement(
    el: HTMLElement, 
    variables: Record<string, VariableInfo>,
    originalSymbols: string[],
    tooltip: HTMLElement,
    onVariableChange: (symbol: string, value: number) => void
  ): void {
    // Log the actual element we're working with for debugging
    console.log(`🔍 Examining element:`, {
      tagName: el.tagName,
      textContent: el.textContent?.trim(),
      style: el.getAttribute('style'),
      innerHTML: el.innerHTML?.substring(0, 50) + (el.innerHTML?.length > 50 ? "..." : "")
    });
    
    // Get just this element's text, not the entire formula
    const text = el.textContent?.trim() || "";
    
    // Log the text we're analyzing
    console.log(`🔍 Element text content: "${text}"`);
    
    // Extract only this element's variable by looking at children
    // This handles the case where MathJax wraps variables in nested elements
    const mjxTexts = Array.from(el.querySelectorAll('mjx-mtext, mjx-mi, mjx-c'))
      .map(el => el.textContent?.trim())
      .filter(Boolean) as string[];
      
    console.log(`🔍 Found text nodes:`, mjxTexts);
    
    // Try to get more specific text by checking child elements
    // Some MathJax versions nest the actual variable text deeper
    let candidateText = text;
    if (mjxTexts.length > 0) {
      // Use the shortest non-empty text which is likely to be the variable name or expression
      const shortestText = mjxTexts.reduce((shortest, current) => 
        (current && current.length < shortest.length) ? current : shortest, text);
      console.log(`🔍 Using shorter text content: "${shortestText}"`);
      candidateText = shortestText;
    }
    
    // Try different regex patterns to catch variables
    const matchPatterns = [
      /([A-Za-z]):\s*(\d+\.?\d*)/,           // D: 5.0
      /([A-Za-z]):\s*(\d+\.?\d*)[^\d]*/,     // D: 5.0 cm
      /^([A-Za-z])(?:[^a-zA-Z0-9]|$)/,       // Just D by itself or followed by non-alphanumeric
      /([A-Za-z])[^a-zA-Z0-9]/,              // D followed by non-alphanumeric
      /^([A-Za-z])$/                          // Just D by itself (single letter)
    ];
    
    // Try matching against our candidate text
    let match = null;
    for (const pattern of matchPatterns) {
      match = candidateText.match(pattern);
      if (match) {
        console.log(`🔍 Found match with pattern in candidateText: "${match[1]}"`);
        break;
      }
    }
    
    // If we didn't find a match in the candidate text, try the element's style info
    if (!match && el.style && el.style.color) {
      console.log(`🔍 No direct match found, checking element color: ${el.style.color}`);
      
      // Find any variables that have this type based on color
      const varType = el.style.color === 'blue' ? 'scrubbable' : 
                     (el.style.color === 'purple' ? 'slideable' : null);
                     
      if (varType) {
        // Try to find a variable with matching type
        for (const [symbol, info] of Object.entries(variables)) {
          if (info.type === varType) {
            const cleanSymbol = symbol.replace(/^\$|\$$/g, '');
            console.log(`🔍 Found variable ${cleanSymbol} with matching type ${varType}`);
            
            // Look for this symbol in the text
            if (text.includes(cleanSymbol)) {
              match = [text, cleanSymbol];
              console.log(`🔍 Variable ${cleanSymbol} found in element text`);
              break;
            }
          }
        }
      }
    }
    
    // If still no match, try checking parent or sibling elements
    if (!match) {
      console.log(`🔍 Checking siblings and parent for variable match`);
      
      // Check sibling elements first
      const siblings = Array.from(el.parentElement?.children || []);
      for (const sibling of siblings) {
        if (sibling === el) continue;
        
        const siblingText = sibling.textContent?.trim() || "";
        for (const pattern of matchPatterns) {
          match = siblingText.match(pattern);
          if (match) {
            console.log(`🔍 Found match in sibling element: "${match[1]}"`);
            break;
          }
        }
        if (match) break;
      }
      
      // If still no match, check parent
      if (!match && el.parentElement) {
        const parentText = el.parentElement.textContent?.trim() || "";
        // Use a regex that finds variables near the current element's text position
        const parentIdx = parentText.indexOf(text);
        if (parentIdx > -1) {
          // Look at text just before and after our element
          const contextText = parentText.substring(Math.max(0, parentIdx - 10), 
                                                 Math.min(parentText.length, parentIdx + text.length + 10));
          console.log(`🔍 Checking context around element: "${contextText}"`);
          
          for (const pattern of matchPatterns) {
            match = contextText.match(pattern);
            if (match) {
              console.log(`🔍 Found match in parent context: "${match[1]}"`);
              break;
            }
          }
        }
      }
    }
    
    if (!match) {
      console.log(`🔍 No variable match found in element`);
      
      // Try to identify the element by color and handle each color type differently
      if (el.style && el.style.color) {
        console.log(`🔍 Trying to match by color: ${el.style.color}`);
        
        let potentialSymbols: string[] = [];
        
        // Map colors to variable types
        const varType = el.style.color === 'blue' ? 'scrubbable' : 
                       el.style.color === 'purple' ? 'slideable' : 
                       el.style.color === 'green' ? 'output' : null;
                       
        if (varType) {
          // Find variables of this type
          for (const [symbol, info] of Object.entries(variables)) {
            if (info.type === varType) {
              const cleanSymbol = symbol.replace(/^\$|\$$/g, '');
              potentialSymbols.push(cleanSymbol);
            }
          }
          
          console.log(`🔍 Potential ${varType} variables:`, potentialSymbols);
          
          // Try each potential symbol
          for (const symbol of potentialSymbols) {
            // If this element has text containing a value (has digits), it's likely our match
            if (/\d/.test(text)) {
              match = [text, symbol];
              console.log(`🔍 Matched element with digits to variable ${symbol}`);
              break;
            }
          }
        }
      }
    }
       
    if (!match) {
      console.log(`🔍 Could not find matching variable for element:`, el);
      return;
    }
    
    const extractedSymbol = match[1];
    console.log(`🔍 Found variable match: ${extractedSymbol}`);
    
    // Find the actual symbol from our variables list by comparing the letter
    // We need to make sure we use the exact symbol format from the original list
    let matchedOriginalSymbol = '';
    for (const origSymbol of originalSymbols) {
      const cleanOrigSymbol = origSymbol.replace(/^\$|\$$/g, '');
      if (cleanOrigSymbol === extractedSymbol) {
        matchedOriginalSymbol = origSymbol;
        break;
      }
    }
    
    // If no direct match, try case-insensitive
    if (!matchedOriginalSymbol) {
      for (const origSymbol of originalSymbols) {
        const cleanOrigSymbol = origSymbol.replace(/^\$|\$$/g, '');
        if (cleanOrigSymbol.toLowerCase() === extractedSymbol.toLowerCase()) {
          matchedOriginalSymbol = origSymbol;
          console.log(`🔍 Found case-insensitive match: ${origSymbol} for ${extractedSymbol}`);
          break;
        }
      }
    }
    
    // If still no match, just use the extracted symbol
    if (!matchedOriginalSymbol) {
      matchedOriginalSymbol = extractedSymbol;
    }
    
    // Check if this symbol is in our variables list
    const variableInfo = variables[matchedOriginalSymbol];
    if (!variableInfo) {
      // Try again with cleaned symbol
      const cleanSymbol = extractedSymbol.replace(/[^a-zA-Z0-9]/g, '');
      const fallbackVariableInfo = variables[cleanSymbol];
      
      if (!fallbackVariableInfo) {
        console.log(`❌ No variable info found for symbol ${matchedOriginalSymbol} or ${cleanSymbol}`);
        return;
      }
      
      if (fallbackVariableInfo.type !== 'scrubbable' && fallbackVariableInfo.type !== 'slideable') {
        console.log(`❌ Variable ${cleanSymbol} is not interactive (type: ${fallbackVariableInfo.type})`);
        return;
      }
      
      console.log(`✅ Setting up interactivity for ${cleanSymbol} (${fallbackVariableInfo.type}) on element:`, el);
      this.setupInteraction(el, cleanSymbol, fallbackVariableInfo, tooltip, onVariableChange);
      return;
    }
    
    if (variableInfo.type !== 'scrubbable' && variableInfo.type !== 'slideable') {
      console.log(`❌ Variable ${matchedOriginalSymbol} is not interactive (type: ${variableInfo.type})`);
      return;
    }
    
    console.log(`✅ Setting up interactivity for ${matchedOriginalSymbol} (${variableInfo.type}) on element:`, el);
    this.setupInteraction(el, matchedOriginalSymbol, variableInfo, tooltip, onVariableChange);
  }
  
  /**
   * Set up interaction handlers for an element
   */
  private setupInteraction(
    el: HTMLElement, 
    symbol: string, 
    variableInfo: VariableInfo,
    tooltip: HTMLElement,
    onVariableChange: (symbol: string, value: number) => void
  ): void {
    // Ensure clean-up of any previous handlers
    if ((el as any)._mousedownHandler) {
      el.removeEventListener('mousedown', (el as any)._mousedownHandler);
      console.log(`Removed previous event handler for ${symbol}`);
    }
    
    // Make element clearly interactive
    el.style.cursor = 'ns-resize';
    
    // Critical: Make sure the pointer events are enabled
    el.style.pointerEvents = 'auto';
    
    // Add a highlight for debugging to see the active element
    el.style.position = 'relative';
    el.dataset.interactive = 'true';
    
    // Set attributes to help with debugging
    el.setAttribute('data-variable', symbol);
    
    // Define the mousedown handler
    const mousedownHandler = (e: MouseEvent) => {
      console.log(`🖱️ [SCRUBBING_START] MOUSEDOWN on ${symbol} at ${e.clientX},${e.clientY}`);
      console.log(`🖱️ Target element:`, e.target);
      
      // Ensure event doesn't propagate
      e.preventDefault();
      e.stopPropagation();
      
      // Track if we're dragging
      let isDragging = true;
      
      // Initial state
      const startY = e.clientY;
      const startValue = variableInfo.value;
      
      // Find all elements in the DOM that display this variable
      // This is for direct update without waiting for the render cycle
      const variableElements = this.findVariableElementsInDOM(el, symbol);
      console.log(`🖱️ Found ${variableElements.length} DOM elements for variable ${symbol}`);
      
      // Use different sensitivity based on the range
      let sensitivity = 0.05;
      if (variableInfo.range) {
        const [min, max] = variableInfo.range;
        const range = max - min;
        // Adjust sensitivity based on range (smaller range = more precision)
        if (range <= 1) {
          sensitivity = 0.005; // Very fine control for small ranges
        } else if (range <= 10) {
          sensitivity = 0.02; // Medium precision for medium ranges
        } else {
          sensitivity = range / 200; // Proportional for larger ranges
        }
      }
      
      console.log(`🖱️ Interaction started for ${symbol}, sensitivity: ${sensitivity}, range:`, variableInfo.range);
      
      // Show tooltip
      tooltip.textContent = this.formatValue(symbol, variableInfo);
      tooltip.style.left = `${e.clientX}px`;
      tooltip.style.top = `${e.clientY - 30}px`;
      tooltip.classList.add('active');
      
      // Add visual feedback to indicate dragging has started
      el.style.opacity = '0.7';
      el.style.backgroundColor = 'rgba(0, 120, 255, 0.1)';
      
      // Mouse move handler
      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging) return;
        
        console.log(`🖱️ [SCRUBBING_MOVE] Mouse move for ${symbol}: ${moveEvent.clientX},${moveEvent.clientY}`);
        
        // Ensure event doesn't propagate
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        
        const deltaY = startY - moveEvent.clientY;
        const newValue = startValue + deltaY * sensitivity;
        
        // Apply range constraints
        let finalValue = newValue;
        if (variableInfo.range) {
          const [min, max] = variableInfo.range;
          finalValue = Math.max(min, Math.min(max, newValue));
        }
        
        // Apply precision if specified
        if (variableInfo.precision !== undefined) {
          const factor = Math.pow(10, variableInfo.precision);
          finalValue = Math.round(finalValue * factor) / factor;
        }
        
        // Only update if value changed
        if (finalValue !== variableInfo.value) {
          // Update tooltip
          tooltip.textContent = this.formatValue(symbol, {...variableInfo, value: finalValue});
          tooltip.style.left = `${moveEvent.clientX}px`;
          tooltip.style.top = `${moveEvent.clientY - 30}px`;
          
          // Log the value change in detail
          console.log(`🖱️ [VARIABLE_CHANGE] ${symbol} = ${finalValue} (delta: ${finalValue - variableInfo.value})`);
          
          // Update stored value (local copy)
          variableInfo.value = finalValue;
          
          // ====== DIRECT DOM UPDATES FOR IMMEDIATE FEEDBACK ======
          // Update all instances of this variable in the DOM for immediate visual feedback
          // This ensures the user sees changes even if the callback chain has issues
          try {
            const formatted = this.formatValueNumber(finalValue, variableInfo.precision);
            
            // Update the current element
            this.updateElementDisplay(el, symbol, finalValue, variableInfo.precision, variableInfo.units);
            
            // Update all other elements showing this variable
            for (const element of variableElements) {
              if (element !== el) {
                this.updateElementDisplay(element, symbol, finalValue, variableInfo.precision, variableInfo.units);
              }
            }
            
            // Find formula output variables and update them directly
            // This provides immediate feedback for computation results
            this.updateDependentVariables(finalValue, symbol);
            
          } catch (e) {
            console.error(`Error updating display:`, e);
          }
          
          // ====== API UPDATE THROUGH CALLBACK ======
          // Call the variable change callback with properly formatted symbol
          console.log(`🖱️ [API_CALL] Calling onVariableChange with symbol: ${symbol} = ${finalValue}`);
          
          // CRITICAL: Call the variable change callback to update the state management system
          onVariableChange(symbol, finalValue);
        }
      };
      
      // Mouse up handler
      const handleMouseUp = (upEvent: MouseEvent) => {
        if (!isDragging) return;
        
        console.log(`🖱️ [SCRUBBING_END] Mouseup: finished dragging ${symbol}, final value: ${variableInfo.value}`);
        
        // Stop dragging
        isDragging = false;
        
        // Ensure event doesn't propagate
        upEvent.preventDefault();
        upEvent.stopPropagation();
        
        // Clean up element appearance
        el.style.opacity = '';
        el.style.backgroundColor = '';
        tooltip.classList.remove('active');
        
        // Remove global event listeners - be thorough in removal to prevent any lingering handlers
        document.removeEventListener('mousemove', handleMouseMove, true);
        window.removeEventListener('mousemove', handleMouseMove, true);
        document.removeEventListener('mouseup', handleMouseUp, true);
        window.removeEventListener('mouseup', handleMouseUp, true);
        
        // Force a final update - ensure the change is properly registered
        // This is critical to make sure the new value sticks
        console.log(`🖱️ [FINAL_UPDATE] ${symbol} = ${variableInfo.value}`);
        onVariableChange(symbol, variableInfo.value);
      };
      
      // Add global event listeners with capture phase
      // Use both document and window to ensure we don't miss events
      document.addEventListener('mousemove', handleMouseMove, true);
      window.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('mouseup', handleMouseUp, true);
      window.addEventListener('mouseup', handleMouseUp, true);
      
      // Set a safety timeout to ensure we clean up even if something goes wrong
      setTimeout(() => {
        if (isDragging) {
          console.log('🖱️ [SAFETY] Safety timeout reached - stopping drag operation');
          isDragging = false;
          
          // Clean up appearance
          el.style.opacity = '';
          el.style.backgroundColor = '';
          tooltip.classList.remove('active');
          
          // Clean up event listeners
          document.removeEventListener('mousemove', handleMouseMove, true);
          window.removeEventListener('mousemove', handleMouseMove, true);
          document.removeEventListener('mouseup', handleMouseUp, true);
          window.removeEventListener('mouseup', handleMouseUp, true);
        }
      }, 30000); // 30 second safety timeout
    };
    
    // Store and add the mousedown handler - use capture phase for reliability
    (el as any)._mousedownHandler = mousedownHandler;
    
    // IMPORTANT: Use capture phase (true) to ensure we get the event first
    el.addEventListener('mousedown', mousedownHandler, true);
    
    // Also directly handle click events as a backup for older browsers
    el.addEventListener('click', (e) => {
      console.log(`🖱️ [CLICK] Clicked on ${symbol} element`);
      // We'll let the mousedown handler do the actual work
    }, true);
    
    // Add hover effect for better UX
    el.addEventListener('mouseenter', (e: MouseEvent) => {
      console.log(`🖱️ [HOVER] Mouse entered ${symbol} element`);
      el.style.backgroundColor = 'rgba(0, 100, 255, 0.1)';
      tooltip.textContent = this.formatValue(symbol, variableInfo);
      tooltip.style.left = `${e.clientX}px`;
      tooltip.style.top = `${e.clientY - 30}px`;
      tooltip.classList.add('active');
    }, true);
    
    el.addEventListener('mouseleave', () => {
      console.log(`🖱️ [HOVER] Mouse left ${symbol} element`);
      el.style.backgroundColor = '';
      tooltip.classList.remove('active');
    }, true);
    
    console.log(`✅ Successfully set up interaction for ${symbol} on element:`, el);
  }
  
  /**
   * Format value display with units
   */
  private formatValue(symbol: string, varInfo: VariableInfo): string {
    const formatted = this.formatValueNumber(varInfo.value, varInfo.precision);
    return `${symbol}: ${varInfo.units ? `${formatted} ${varInfo.units}` : formatted}`;
  }
  
  /**
   * Format just the number with precision
   */
  private formatValueNumber(value: number, precision?: number): string {
    return precision !== undefined ? value.toFixed(precision) : value.toString();
  }
  
  /**
   * Find all elements in the DOM that display a specific variable
   */
  private findVariableElementsInDOM(startElement: HTMLElement, symbol: string): HTMLElement[] {
    if (!symbol) return [];
    
    console.log(`🔍 [FIND_ELEMENTS] Starting search for variable ${symbol}`, startElement);
    
    // Clean the symbol to handle different formats
    const cleanSymbol = symbol.replace(/^\$|\$$/g, '');
    
    // First, check if this element has the right data attribute
    const elements: HTMLElement[] = [];
    
    // Start with the element itself
    if (startElement.getAttribute('data-variable') === symbol ||
        startElement.getAttribute('data-variable') === cleanSymbol) {
      elements.push(startElement);
      console.log(`🔍 [FIND_ELEMENTS] Found element with data-variable=${symbol}`);
    }
    
    // Then look for elements with matching text content
    const container = startElement.closest('.interactive-formula-container') as HTMLElement;
    if (container) {
      // Find all elements with text containing the symbol
      const allElements = Array.from(container.querySelectorAll('*')) as HTMLElement[];
      
      for (const el of allElements) {
        const text = el.textContent || "";
        
        // Use a more exact pattern matching to avoid confusion between W and D
        // This is a critical fix to ensure we don't match W in words like "Width"
        // or D in words like "Distance"
        
        // Match patterns that look exactly like "W: 1.0" or "D: 5.0"
        const exactVarPattern = new RegExp(`(^|[^a-zA-Z0-9])${cleanSymbol}\\s*:`, 'i');
        
        if (exactVarPattern.test(text)) {
          console.log(`🔍 [FIND_ELEMENTS] Found element with text pattern match for ${cleanSymbol}: "${text}"`);
          
          // Further validation to make sure we're not mixing up variables
          const otherSymbols = ['W', 'D'].filter(s => s !== cleanSymbol);
          let isCorrectVariable = true;
          
          // Check if this text contains OTHER variable patterns that might cause confusion
          for (const otherSymbol of otherSymbols) {
            // If the text contains both our variable and another variable, we need to be more careful
            if (text.includes(`${otherSymbol}:`) || text.includes(`${otherSymbol.toLowerCase()}:`)) {
              // In this case, we need more precise checking
              // Extract just the part that contains our variable and its value
              const exactMatch = text.match(new RegExp(`(^|[^a-zA-Z0-9])(${cleanSymbol})\\s*:\\s*([\\d\\.]+)`, 'i'));
              if (exactMatch) {
                console.log(`🔍 [FIND_ELEMENTS] Found EXACT variable match: ${exactMatch[2]}: ${exactMatch[3]}`);
                isCorrectVariable = true;
              } else {
                // If we can't get an exact match when there are multiple variables, skip this element
                isCorrectVariable = false;
                console.log(`🔍 [FIND_ELEMENTS] Text contains both ${cleanSymbol} and ${otherSymbol}, but couldn't extract exact match`);
              }
            }
          }
          
          if (isCorrectVariable) {
            elements.push(el);
            // Add data attribute for future reference
            el.setAttribute('data-variable', cleanSymbol);
          }
        }
      }
    }
    
    console.log(`🔍 [FIND_ELEMENTS] Found ${elements.length} elements for variable ${symbol}`);
    // Log the actual elements for debugging
    elements.forEach((el, i) => {
      console.log(`🔍 [FIND_ELEMENTS] Element ${i+1} for ${symbol}:`, {
        tag: el.tagName,
        text: el.textContent?.trim(),
        style: el.getAttribute('style')
      });
    });
    
    return elements;
  }
  
  /**
   * Updates DOM elements for dependent variables after an input variable change
   */
  private updateDependentVariables(newValue: number, symbol: string): void {
    if (!symbol) return;
    
    console.log(`🔍 [UPDATE_DEPENDENT] Updating dependent variables triggered by ${symbol}=${newValue}`);
    
    // Find the container for the formula
    const container = document.querySelector('.interactive-formula-container');
    if (!container) {
      console.log(`🔍 [UPDATE_DEPENDENT] No container found`);
      return;
    }
    
    // Find all green-colored elements (output variables)
    const outputElements = this.findElementsByAttribute(container as HTMLElement, '[style*="color: green"]');
    
    if (outputElements.length > 0) {
      console.log(`🔍 [UPDATE_DEPENDENT] Found ${outputElements.length} output elements to update`);
      
      // Process each output element
      outputElements.forEach(el => {
        try {
          const text = el.textContent || "";
          console.log(`🔍 [UPDATE_DEPENDENT] Examining output element text: "${text}"`);
          
          // Extract the output variable symbol using more precise pattern matching
          // Look for patterns like "T: 1.23"
          const symbolMatch = text.match(/([a-zA-Z])[^:]*:\s*([\d\.]+)/);
          
          if (symbolMatch) {
            const outputSymbol = symbolMatch[1];
            
            // Make sure this is clearly an output variable with no confusion
            // We don't want to accidentally update W when we're dealing with D, etc.
            if (outputSymbol && outputSymbol !== symbol) {
              console.log(`🔍 [UPDATE_DEPENDENT] Found output variable ${outputSymbol} with current value ${symbolMatch[2]}`);
              
              // Just a temporary update - in a real app, this value would come from the computation engine
              // This is just for visual feedback while real computation happens
              const tempValue = newValue * 2; // Simple example transformation
              
              console.log(`🔍 [UPDATE_DEPENDENT] Setting temporary value ${tempValue} for ${outputSymbol}`);
              
              // Ensure we mark this element with the correct variable
              el.setAttribute('data-variable', outputSymbol);
              
              // Update the display with high precision
              this.updateElementDisplay(el, outputSymbol, tempValue, 2);
            } else {
              console.log(`🔍 [UPDATE_DEPENDENT] Skipping update for ${outputSymbol} - same as trigger variable`);
            }
          } else {
            console.log(`🔍 [UPDATE_DEPENDENT] Could not extract variable from text: "${text}"`);
          }
        } catch (e) {
          console.error(`❌ [UPDATE_DEPENDENT] Error updating output element:`, e);
        }
      });
    } else {
      console.log(`🔍 [UPDATE_DEPENDENT] No output elements found`);
    }
  }

  /**
   * Helper to update element display for immediate visual feedback
   */
  private updateElementDisplay(
    el: HTMLElement, 
    symbol: string, 
    value: number, 
    precision?: number,
    units?: string
  ): void {
    // Format the value with precision
    const formatted = precision !== undefined ? 
      value.toFixed(precision) : 
      value.toString();
    
    console.log(`🔄 [UPDATE_ELEMENT] Updating element for ${symbol} with value ${formatted}`);
    
    // Try to find text content with the symbol and a value
    // CRITICAL FIX: Use a more precise pattern that ensures we only match the exact variable
    // This prevents issues like matching W inside of a text that talks about D and W
    const exactSymbolPattern = new RegExp(`(^|[^a-zA-Z0-9])(${symbol})\\s*:\\s*([\\d\\.]+)`, 'i');
    const text = el.textContent || '';
    
    // Log the current element text for debugging
    console.log(`🔄 [UPDATE_ELEMENT] Current element text: "${text}"`);
    
    const match = text.match(exactSymbolPattern);
    
    if (match) {
      // We found an exact match for this symbol
      console.log(`🔄 [UPDATE_ELEMENT] Found exact match for ${symbol} with value ${match[3]}`);
      
      // Replace just the value part
      const newText = text.replace(exactSymbolPattern, `$1$2: ${formatted}${units ? ' ' + units : ''}`);
      console.log(`🔄 [UPDATE_ELEMENT] Updating text from "${text}" to "${newText}"`);
      
      // Update the text content
      el.textContent = newText;
      
      // Also update the data-value attribute for reference
      el.setAttribute('data-value', formatted);
    } else {
      // If no direct match, we should be more careful about updating the text
      console.log(`🔄 [UPDATE_ELEMENT] No exact pattern match for ${symbol}`);
      
      // Try parent elements if no direct match
      let currentEl: HTMLElement | null = el;
      let depth = 0;
      
      while (currentEl && depth < 3) {
        const parentText = currentEl.textContent || '';
        const parentMatch = parentText.match(exactSymbolPattern);
        
        if (parentMatch) {
          console.log(`🔄 [UPDATE_ELEMENT] Found match in parent at depth ${depth}`);
          
          // Make sure we don't have other variables in the same text that might cause confusion
          if (parentText.includes(`${symbol}:`) && 
             !(['W', 'D'].filter(s => s !== symbol).some(s => parentText.includes(`${s}:`)))) {
            // Safe to update - no other variable patterns found
            
            // Look for a text node or element containing just the value
            const valueElements = Array.from(currentEl.querySelectorAll('*')).filter(child => {
              const childText = child.textContent || '';
              return /^[\d\.]+$/.test(childText);
            });
            
            if (valueElements.length > 0) {
              console.log(`🔄 [UPDATE_ELEMENT] Found exact value element to update`);
              valueElements[0].textContent = formatted;
              (valueElements[0] as HTMLElement).setAttribute('data-value', formatted);
            } else {
              // Direct text node replacement is challenging
              // Just update the entire content as a fallback
              const newParentText = parentText.replace(exactSymbolPattern, `$1$2: ${formatted}${units ? ' ' + units : ''}`);
              currentEl.textContent = newParentText;
            }
          } else {
            console.log(`🔄 [UPDATE_ELEMENT] Skipping update - text contains multiple variables`);
          }
          
          break;
        }
        
        currentEl = currentEl.parentElement;
        depth++;
      }
    }
  }

  /**
   * Helper to analyze the structure of a DOM element
   */
  private analyzeElement(element: Element, depth = 0, maxDepth = 2): any {
    if (depth > maxDepth) return '...';
    
    const children = Array.from(element.children).map(child => {
      return this.analyzeElement(child, depth + 1, maxDepth);
    });
    
    return {
      tag: element.tagName,
      class: element.className || undefined,
      id: element.id || undefined,
      style: (element as HTMLElement).style?.cssText || undefined,
      text: element.textContent?.trim() || undefined,
      children: children.length ? children : undefined,
    };
  }
  
  /**
   * Find a better matching element for a variable near the current element
   * Used as a fallback when variable identification is uncertain
   */
  private findBetterVariableMatch(currentElement: HTMLElement, variableSymbol: string): HTMLElement | null {
    console.log(`🔍 [FIND_BETTER] Looking for better match for variable ${variableSymbol}`);
    
    // Start with siblings and parent element
    const container = currentElement.closest('.interactive-formula-container');
    if (!container) return null;
    
    // Create a precise pattern to match the variable
    const exactPattern = new RegExp(`\\b${variableSymbol}\\s*:`, 'i');
    
    // Look at nearby elements (siblings first)
    const parent = currentElement.parentElement;
    if (parent) {
      // Check siblings
      const siblings = Array.from(parent.children) as HTMLElement[];
      for (const sibling of siblings) {
        if (sibling === currentElement) continue;
        
        const text = sibling.textContent || '';
        if (exactPattern.test(text)) {
          console.log(`🔍 [FIND_BETTER] Found better match in sibling: "${text}"`);
          return sibling;
        }
      }
    }
    
    // Search 20px in each direction
    const rect = currentElement.getBoundingClientRect();
    const searchArea = {
      left: rect.left - 20,
      right: rect.right + 20,
      top: rect.top - 20,
      bottom: rect.bottom + 20
    };
    
    // Get all elements in container
    const allElements = Array.from(container.querySelectorAll('*')) as HTMLElement[];
    
    // Filter to elements in search area with the text pattern
    for (const element of allElements) {
      if (element === currentElement) continue;
      
      const text = element.textContent || '';
      if (!exactPattern.test(text)) continue;
      
      // Check if in search area
      const elemRect = element.getBoundingClientRect();
      if (elemRect.right >= searchArea.left && 
          elemRect.left <= searchArea.right &&
          elemRect.bottom >= searchArea.top && 
          elemRect.top <= searchArea.bottom) {
        
        console.log(`🔍 [FIND_BETTER] Found better match nearby: "${text}"`);
        return element;
      }
    }
    
    // No better match found
    return null;
  }
} 
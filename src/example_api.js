defineEquation({
  formula: "T = a + b * log((2 * D) / W)",
  variables: {
    "$a$": { type: "constant", value: 0.1 },
    "$b$": { type: "constant", value: 0.5 },
    "$D$": { type: "input", range: [0, 10], round: 1, units: "in." },
    "$W$": { type: "input", range: [0.01, 2], round: 2, units: "in." },
    "$T$": { type: "output", round: 2, units: "s" }
  }
});

createFormula("kinetic-energy")
  .equation("K = \\frac{1}{2}mv^2")
  .dependent({
    K: {
      units: "J",
      label: "kinetic energy", // can make optional
      precision: 1
    }
  })
  .constant({ // "constant" means "fixed"
    m: {
      value: 1,
      units: "kg", 
      label: "mass",
      precision: 2
    }
  })
  .input({ // "input" means "slideable"
    v: {
      initialValue: 1,
      range: [-10, 10],
      step: 0.1,
      units: "m/s",
      label: "velocity",
    }
  });

// distill example
createFormula("momentum-curves")
  .equation("c_1p_1 + c_2p_2 + c_3p_3 + c_4p_4 + c_5p_5 + c_6p_6 = model")
  .input({
    c1: { initial: 1, range: [-10, 10], step: 0.1, label: "coefficient 1" },
    c2: { initial: 1, range: [-10, 10], step: 0.1, label: "coefficient 2" },
    c3: { initial: 1, range: [-10, 10], step: 0.1, label: "coefficient 3" }, 
    c4: { initial: 1, range: [-10, 10], step: 0.1, label: "coefficient 4" },
    c5: { initial: 1, range: [-10, 10], step: 0.1, label: "coefficient 5" },
    c6: { initial: 1, range: [-10, 10], step: 0.1, label: "coefficient 6" }
  })
  .renderGraphs({
    graphs: [
      {
        fn: (x, c1) => c1 * x,
        label: "p1", 
        color: "#FFA500",
        showAxes: true
      },
      {
        fn: (x, c2) => c2 * x**2,
        label: "p2",
        color: "#FFA500",
        showAxes: true
      },
      {
        fn: (x, c3) => c3 * x**3,
        label: "p3",
        color: "#FFA500",
        showAxes: true
      },
      {
        fn: (x, c4) => c4 * x**4, 
        label: "p4",
        color: "#FFA500",
        showAxes: true
      },
      {
        fn: (x, c5) => c5 * x**5,
        label: "p5", 
        color: "#FFA500",
        showAxes: true
      },
      {
        fn: (x, c6) => c6 * x**6,
        label: "p6",
        color: "#FFA500",
        showAxes: true
      },
      {
        fn: (x, c1, c2, c3, c4, c5, c6) => c1 * x + c2 * x**2 + c3 * x**3 + c4 * x**4 + c5 * x**5 + c6 * x**6,
        label: "model",
        color: "#FFA500",
        showAxes: true
      }
    ],

    axes: {
      x: { 
        domain: [-5, 5], 
        label: "x",
        ticks: 11
      }
    }
  })

  .handleInteractions({
    // when coefficients are scrubbed, update the graphs (and maybe the equation?)
    coefficientChange: (coeffs) => {
      updateGraphs(coeffs);
      updateEquation(coeffs);
    },

  });

// Vega-Lite example
// similar to Vega-Lite's "data" and "transform" components
defineEquation({
  formula: "K = 1/2 * m * v^2",
  variables: {
    "m": { 
      type: "input", 
      range: [0, 100],
      default: 1,
      units: "kg" 
    },
    "v": { 
      type: "input", 
      range: [0, 50],
      default: 10, 
      units: "m/s" 
    },
    "K": { 
      type: "output",
      units: "J" 
    }
  }
});

// Section 3.1: "A unit specification describes a single Cartesian plot, with a backing data set, a
// given mark-type, and a set of one or more encoding definitions for visual channels such as position 
// (x, y), color, size, etc."
defineView({
  type: "2d",
  // encoding := (channel, field, data-type, value, functions, scale, guide)
  encoding: {
    x: { variable: "v", label: "Velocity" },
    y: { variable: "K", label: "Kinetic Energy" }
  },
  // Section 3.2.1: "The layer operator accepts multiple unit specifications to produce a
  // view in which subsequent charts are plotted on top of each other."
  layers: [
    {
      type: "curve",
      style: { color: "blue", width: 2 }
    },
    {
      type: "point",
      // Section 4: "selections identify the set of points a user is interested in manipulating"
      interactive: true, 
      style: { color: "red", size: 8 }
    }
  ]
});

// Section 4: "Vega-Lite extends the definition of unit specifications to also include a set of selections.
// Selection identify the set of points a user is interested in manipulating."
// selection := (name, type, predicate, domain|range, event, init, transforms, resolve)
defineInteractions({
  plot: {
    // Section 4.2: "translate transform offsets spatial properties of backing points"
    type: "drag",
    variable: "v",
    updates: "continuous",
    // Section 4.3: "selections can define scale extents"
    constrainToView: true
  },
  controls: [
    {
      variable: "m",
      type: "slider",
      // Section 3.1: "signals parameterize the remainder of the visualization specification"
      updates: "continuous"
    },
    {
      variable: "v", 
      type: "slider",
      // From paper section 4.3: "selections can be composed using logical  operators"
      linkToPlot: true
    }
  ]
});

// Section 3.2.2: "To place views side-by-side, Vega-Lite provides operators 
// for horizontal and vertical concatenation"
defineLayout({
  // From paper: "vconcat([view1, view2, ...], resolve)"
  type: "vconcat",
  views: [
    {
      type: "1d",
      variable: "v",
      height: 100
    },
    {
      type: "2d",
      ref: "mainPlot", 
      height: 300
    }
  ]
});
import { useCallback, useEffect, useState } from "react";

import { toJS } from "mobx";
import { observer } from "mobx-react-lite";

import {
  RenderSpec, // deriveAugmentedFormula
} from "./FormulaTree";
import { formulaStore, selectionStore } from "./store";

export const RenderedFormula = observer(() => {
  // For development, hardcode a formula to reset to when code changes
  // useEffect(() => {
  //   formulaStore.updateFormula(
  //     deriveAugmentedFormula(
  //       String.raw`\textcolor{red}{\frac{a + \cancel{{b + c}}}{\underbrace{d + e}_\text{caption} + f}} + \sqrt{\fcolorbox{black}{white}{$ {g + h} $} + i}`
  //     )
  //   );
  // }, []);

  useEffect(() => {
    const resizeHandler = () => {
      requestAnimationFrame(() => {
        selectionStore.updateTargets();
      });
    };
    window.addEventListener("resize", resizeHandler);

    () => {
      window.removeEventListener("resize", resizeHandler);
    };
  }, []);

  useEffect(
    () => {
      console.log("Updating targets");
      requestAnimationFrame(() => {
        selectionStore.updateTargets();
      });
    },
    // For performance reasons, we only want this to trigger when we have a new formula to render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formulaStore.renderSpec]
  );

  const handleSetRef = useCallback((ref: Element | null) => {
    selectionStore.initializeFormulaRoot(ref);
  }, []);

  return (
    <div
      ref={handleSetRef}
      style={{
        transform: `translate(${selectionStore.pan.x}px, ${selectionStore.pan.y}px)`,
      }}
    >
      {formulaStore.renderSpec !== null && (
        <RenderedFormulaComponent spec={toJS(formulaStore.renderSpec)} />
      )}
    </div>
  );
});

const RenderedFormulaComponent = observer(({ spec }: { spec: RenderSpec }) => {
  const [ref, setRef] = useState<Element | null>(null);
  useEffect(() => {
    if (spec.id && ref) {
      selectionStore.addTarget(
        spec.id,
        ref,
        ["mjx-mi", "mjx-mn", "mjx-mo", "mjx-mtext"].includes(spec.tagName)
      );
    }

    () => {
      console.log("Target cleanup running");
      if (spec.id) {
        selectionStore.removeTarget(spec.id);
      }
    };
  }, [ref, spec.id, spec.tagName]);

  const Tag = spec.tagName;
  return (
    // TODO: React throws a seemingly harmless error about `class` vs `className`
    // @ts-expect-error This is an arbitrary tag, we can't statically type it
    <Tag
      id={spec.id}
      class={spec.className}
      style={spec.style}
      {...spec.attrs}
      ref={(ref: unknown) => setRef(ref as Element)}
    >
      {spec.children?.map((child, i) => (
        <RenderedFormulaComponent key={i} spec={child} />
      ))}
    </Tag>
  );
});

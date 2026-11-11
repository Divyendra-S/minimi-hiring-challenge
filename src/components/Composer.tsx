import { type ComponentType, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpIcon, StopIcon } from "./icons";

export type Suggestion = {
  label: string;
  prompt: string;
  icon: ComponentType<{ className?: string }>;
};

type Props = {
  busy: boolean;
  onSend: (message: string) => void;
  onStop: () => void;
  /** Set on a new chat: the box sits mid-page with starter prompts under it, instead of docked. */
  suggestions?: Suggestion[];
};

/** While an answer streams, typing stays possible but Send becomes Stop. */
export function Composer({ busy, onSend, onStop, suggestions }: Props) {
  const [text, setText] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const placed = useRef<{ home: boolean; top: number } | null>(null);
  const glide = useRef<Animation | null>(null);
  const home = suggestions !== undefined;

  // Between the centered and the docked layout the box glides from where it was to its new place
  // instead of jumping. (Arriving on a new chat page, it rises in by CSS, with the rest of the page.)
  useLayoutEffect(() => {
    const box = form.current;
    const before = placed.current;
    const motionOk = matchMedia("(prefers-reduced-motion: no-preference)").matches;
    if (!box || !before || before.home === home || !motionOk) return; // also skips Strict Mode's re-run
    // This is a move, not an arrival: drop the CSS entrance in favour of the glide.
    for (const animation of box.getAnimations())
      if (animation !== glide.current) animation.cancel();
    // A glide still in flight is continued from where it is drawn, not restarted.
    const shift = shiftOf(box);
    const drawnBefore = before.top + shift;
    const placedNow = box.getBoundingClientRect().top - shift;
    glide.current?.cancel();
    glide.current = box.animate(
      [{ transform: `translateY(${drawnBefore - placedNow}px)` }, { transform: "none" }],
      { duration: 600, easing: EASE_OUT },
    );
  }, [home]);

  // Where the box sits in the layout after every render, for the glide above.
  useLayoutEffect(() => {
    const box = form.current;
    if (box) placed.current = { home, top: box.getBoundingClientRect().top - shiftOf(box) };
  });

  // Ready to type on load, except on touch screens, where focus would pop up the keyboard.
  useEffect(() => {
    if (matchMedia("(pointer: fine)").matches) input.current?.focus();
  }, []);

  function submit() {
    const message = text.trim();
    if (!message || busy) return;
    setText("");
    onSend(message);
  }

  // Both layouts keep the same element tree, so the textarea (and its focus) survives the switch.
  return (
    <div className={home ? "px-6" : "px-6 pt-2 pb-5"}>
      <div className={`mx-auto w-full ${home ? "max-w-2xl" : "max-w-3xl"}`}>
        <form
          ref={form}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className={`flex items-end gap-2 rounded-[26px] bg-white py-2 pr-2 pl-5 shadow-float transition-shadow duration-200 focus-within:shadow-float-focus ${home ? "motion-safe:animate-enter motion-safe:[animation-delay:180ms]" : ""}`}
        >
          <textarea
            ref={input}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter adds a line; ignore Enter while an IME is composing.
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Ask anything"
            aria-label="Message"
            rows={1}
            className="field-sizing-content max-h-40 flex-1 resize-none bg-transparent py-1.5 text-[14px] leading-6 text-text-primary outline-none placeholder:text-text-tertiary"
          />
          {busy ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop"
              className={`${round} bg-text-primary hover:bg-text-secondary`}
            >
              <StopIcon className="size-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!text.trim()}
              aria-label="Send"
              className={`${round} bg-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(91_99_224/0.4)] hover:bg-accent/90 disabled:bg-surface-1 disabled:text-text-tertiary disabled:shadow-none`}
            >
              <ArrowUpIcon className="size-[18px]" />
            </button>
          )}
        </form>

        {suggestions && (
          <ul className="mt-4 flex flex-wrap justify-center gap-2 motion-safe:animate-enter motion-safe:[animation-delay:240ms]">
            {suggestions.map(({ label, prompt, icon: Icon }) => (
              <li key={label}>
                <button
                  type="button"
                  title={prompt}
                  onClick={() => {
                    setText(prompt);
                    input.current?.focus();
                  }}
                  className="flex items-center gap-2 rounded-full bg-white py-2 pr-3.5 pl-3 text-[12px] text-text-secondary shadow-ring sm:pr-4 sm:pl-3.5 sm:text-[13px] transition-[box-shadow,color,scale] duration-200 hover:text-text-primary hover:shadow-ring-hover active:scale-[0.97]"
                >
                  <Icon className="size-4 text-accent" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** A long, soft ease-out: quick to start, slow to settle. */
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

/** How far an animation has moved the box vertically right now. */
function shiftOf(box: HTMLElement): number {
  return new DOMMatrixReadOnly(getComputedStyle(box).transform).m42;
}

const round =
  "flex size-9 shrink-0 items-center justify-center rounded-full text-white transition-[background-color,color,scale] duration-200 active:scale-95";

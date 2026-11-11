import { useState } from "react";

type Props = { busy: boolean; onSend: (message: string) => void; onStop: () => void };

/** While an answer streams, typing stays possible but Send becomes Stop. */
export function Composer({ busy, onSend, onStop }: Props) {
  const [text, setText] = useState("");

  function submit() {
    const message = text.trim();
    if (!message || busy) return;
    setText("");
    onSend(message);
  }

  return (
    <form
      className="border-t border-neutral-200"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2 p-4">
        <textarea
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
          className="field-sizing-content max-h-48 flex-1 resize-none rounded-xl border border-neutral-300 px-4 py-2.5 outline-none focus:border-neutral-500"
        />
        {busy ? (
          <button type="button" onClick={onStop} className={button}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!text.trim()} className={button}>
            Send
          </button>
        )}
      </div>
    </form>
  );
}

const button = "rounded-xl bg-neutral-900 px-4 py-2.5 text-white disabled:opacity-40";

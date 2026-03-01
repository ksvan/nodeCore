"use client";

import { useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { bracketMatching } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";
import type { JsonSnippet, JsonTemplate } from "@/lib/json-templates";

interface JsonParseErrorInfo {
  message: string;
  line: number | null;
  column: number | null;
}

const formatJson = (value: string): string => JSON.stringify(JSON.parse(value || "{}"), null, 2);

const tryParseJson = (value: string): JsonParseErrorInfo | null => {
  try {
    JSON.parse(value || "{}");
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    const lineColumn = /line\s+(\d+)\s+column\s+(\d+)/i.exec(message);
    if (lineColumn) {
      return {
        message,
        line: Number(lineColumn[1]),
        column: Number(lineColumn[2]),
      };
    }

    const position = /position\s+(\d+)/i.exec(message);
    if (position) {
      const offset = Number(position[1]);
      if (!Number.isNaN(offset)) {
        const upToError = value.slice(0, offset);
        const lines = upToError.split("\n");
        const line = lines.length;
        const column = (lines[lines.length - 1]?.length ?? 0) + 1;
        return {
          message,
          line,
          column,
        };
      }
    }

    return {
      message,
      line: null,
      column: null,
    };
  }
};

const tryAppendSnippet = (
  current: string,
  snippet: JsonSnippet,
): string | null => {
  if (!snippet.targetArrayPath) {
    return null;
  }

  try {
    const parsed = JSON.parse(current || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const keys = snippet.targetArrayPath.split(".").filter((part) => part.length > 0);
    if (keys.length === 0) {
      return null;
    }

    let node: Record<string, unknown> = parsed as Record<string, unknown>;
    for (let index = 0; index < keys.length - 1; index += 1) {
      const key = keys[index];
      const next = node[key];
      if (!next || typeof next !== "object" || Array.isArray(next)) {
        return null;
      }
      node = next as Record<string, unknown>;
    }

    const targetKey = keys[keys.length - 1];
    const target = node[targetKey];
    if (!Array.isArray(target)) {
      return null;
    }

    target.push(snippet.value);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return null;
  }
};

export function JsonEditor({
  label,
  value,
  onChange,
  templates,
  snippets,
  readOnly = false,
  height = "260px",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  templates?: ReadonlyArray<JsonTemplate>;
  snippets?: ReadonlyArray<JsonSnippet>;
  readOnly?: boolean;
  height?: string;
}) {
  const viewRef = useRef<EditorView | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const parseError = useMemo(() => tryParseJson(value), [value]);

  const onFormat = () => {
    try {
      onChange(formatJson(value));
    } catch {
      // parse error shown inline
    }
  };

  const onCopy = async () => {
    await navigator.clipboard.writeText(value);
  };

  const applyTemplate = (labelValue: string) => {
    if (!templates || !labelValue) {
      return;
    }
    const template = templates.find((item) => item.label === labelValue);
    if (!template) {
      return;
    }
    onChange(JSON.stringify(template.value, null, 2));
  };

  const insertSnippet = (snippet: JsonSnippet) => {
    const appended = tryAppendSnippet(value, snippet);
    if (appended) {
      onChange(appended);
      return;
    }

    const snippetText = `\n${JSON.stringify(snippet.value, null, 2)}\n`;
    const view = viewRef.current;
    if (view) {
      const cursor = view.state.selection.main.head;
      view.dispatch({
        changes: { from: cursor, to: cursor, insert: snippetText },
      });
      return;
    }

    onChange(`${value}${snippetText}`);
  };

  return (
    <div className="stack">
      <label>{label}</label>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ flex: 1 }}>
          {templates && templates.length > 0 ? (
            <select
              value={selectedTemplate}
              onChange={(event) => {
                setSelectedTemplate(event.target.value);
                applyTemplate(event.target.value);
              }}
              disabled={readOnly}
            >
              <option value="">Templates</option>
              {templates.map((template) => (
                <option key={template.label} value={template.label}>
                  {template.label}
                </option>
              ))}
            </select>
          ) : null}

          {snippets && snippets.length > 0 ? (
            <div className="row" style={{ gap: 6 }}>
              {snippets.map((snippet) => (
                <button
                  key={snippet.label}
                  type="button"
                  onClick={() => insertSnippet(snippet)}
                  disabled={readOnly}
                >
                  {snippet.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="row" style={{ gap: 6 }}>
          <button type="button" onClick={onFormat} disabled={readOnly || Boolean(parseError)}>
            Prettify
          </button>
          <button type="button" onClick={() => void onCopy()}>
            Copy
          </button>
        </div>
      </div>

      <CodeMirror
        value={value}
        height={height}
        onChange={(next) => onChange(next)}
        onCreateEditor={(view) => {
          viewRef.current = view;
        }}
        extensions={[json(), bracketMatching()]}
        basicSetup={{
          lineNumbers: true,
          bracketMatching: true,
          foldGutter: true,
          indentOnInput: true,
          autocompletion: true,
        }}
        editable={!readOnly}
      />

      {parseError ? (
        <div className="error-box">
          Invalid JSON: {parseError.message}
          {parseError.line && parseError.column
            ? ` (line ${parseError.line}, column ${parseError.column})`
            : ""}
        </div>
      ) : null}
    </div>
  );
}

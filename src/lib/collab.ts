import debounce from "lodash.debounce";
import type {
  IDisposable,
  IPosition,
  editor,
} from "monaco-editor/esm/vs/editor/editor.api";
import { OpSeq } from "wasm";
import markdownSample  from "../../markdown.txt?raw"

export type Options = {
  readonly uri: string;
  readonly editor: editor.IStandaloneCodeEditor;
  readonly onConnected?: () => void;
  readonly onDisconnected?: () => void;
  readonly onChangeUsers?: (users: Record<number, UserInfo>) => void;
  readonly reconnectInterval?: number;
};

export type UserInfo = {
  readonly name: string;
  readonly color: number;
};

export class Collab {
  private ws?: WebSocket;
  private connecting?: boolean;
  private recentFailures: number = 0;
  private readonly model: editor.ITextModel;
  private readonly onChangeHandle: IDisposable;
  private readonly onCursorHandle: IDisposable;
  private readonly onSelectionHandle: IDisposable;
  private readonly beforeUnload: (event: BeforeUnloadEvent) => void;
  private readonly tryConnectId: number;
  private readonly resetFailuresId: number;

  private markdownSampleLoaded: boolean = false
  private me: number = -1;
  private revision: number = 0;
  private outstandingOp?: OpSeq;
  private buffer?: OpSeq;
  private users: Record<number, UserInfo> = {};
  private userCursors: Record<number, CursorData> = {};
  private myInfo?: UserInfo;
  private cursorData: CursorData = { cursors: [], selections: [] };

  private lastValue: string = "";
  private ignoreChanges: boolean = false;
  private oldDecorations: string[] = [];

  constructor(readonly options: Options) {
    this.model = options.editor.getModel()!;
    this.onChangeHandle = options.editor.onDidChangeModelContent((e) =>
      this.onChange(e),
    );
    const cursorUpdate = debounce(() => this.sendCursorData(), 20);
    this.onCursorHandle = options.editor.onDidChangeCursorPosition((e) => {
      this.onCursor(e);
      cursorUpdate();
    });
    this.onSelectionHandle = options.editor.onDidChangeCursorSelection((e) => {
      this.onSelection(e);
      cursorUpdate();
    });
    this.beforeUnload = (event: BeforeUnloadEvent) => {
      if (this.outstandingOp) {
        event.preventDefault();
        event.returnValue = "";
      } else {
        delete event.returnValue;
      }
    };
    window.addEventListener("beforeunload", this.beforeUnload);

    const interval = options.reconnectInterval ?? 1000;
    this.tryConnect();
    this.tryConnectId = window.setInterval(() => this.tryConnect(), interval);
    this.resetFailuresId = window.setInterval(
      () => (this.recentFailures = 0),
      15 * interval,
    );
  }

  dispose() {
    window.clearInterval(this.tryConnectId);
    window.clearInterval(this.resetFailuresId);
    this.onSelectionHandle.dispose();
    this.onCursorHandle.dispose();
    this.onChangeHandle.dispose();
    window.removeEventListener("beforeunload", this.beforeUnload);
    this.ws?.close();
  }


  setInfo(info: UserInfo) {
    this.myInfo = info;
    this.sendInfo();
  }

  // Attempts websocket connection.
  private tryConnect() {
    if (this.connecting || this.ws) return;
    this.connecting = true;
    const ws = new WebSocket(this.options.uri);
    ws.onopen = () => {
      this.connecting = false;
      this.ws = ws;
      this.options.onConnected?.();
      this.users = {};
      this.options.onChangeUsers?.(this.users);
      this.sendInfo();
      this.sendCursorData();
      if (this.outstandingOp) {
        this.sendOperation(this.outstandingOp);
      }
    };
    ws.onclose = () => {
      if (this.ws) {
        this.ws = undefined;
        this.options.onDisconnected?.();
        if (++this.recentFailures >= 5) {
          this.dispose();
        }
      } else {
        this.connecting = false;
      }
    };
    ws.onmessage = ({ data }) => {
      if (typeof data === "string") {
        this.handleMessage(JSON.parse(data));
      }
    };
  }

  private handleMessage(msg: ServerMessage) {
    if (msg.Identity !== undefined) {
      this.me = msg.Identity;
      if (!this.markdownSampleLoaded && this.me == 0) {
        this.model.setValue(markdownSample)
        this.markdownSampleLoaded = true
      }
    } else if (msg.History !== undefined) {
      const { start, operations } = msg.History;
      if (start > this.revision) {
        console.log("History message has start greater than last operation.");
        this.ws?.close();
        return;
      }
      for (let i = this.revision - start; i < operations.length; i++) {
        let { id, operation } = operations[i];
        this.revision++;
        if (id === this.me) {
          this.serverAck();
        } else {
          operation = OpSeq.from_str(JSON.stringify(operation));
          this.applyServer(operation);
        }
      }
    } else if (msg.UserInfo !== undefined) {
      const { id, info } = msg.UserInfo;
      if (id !== this.me) {
        this.users = { ...this.users };
        if (info) {
          this.users[id] = info;
        } else {
          delete this.users[id];
          delete this.userCursors[id];
        }
        this.updateCursors();
        this.options.onChangeUsers?.(this.users);
      }
    } else if (msg.UserCursor !== undefined) {
      const { id, data } = msg.UserCursor;
      if (id !== this.me) {
        this.userCursors[id] = data;
        this.updateCursors();
      }
    }
  }

  private serverAck() {
    if (!this.outstandingOp) {
      console.warn("Received serverAck with no outstanding operation.");
      return;
    }
    this.outstandingOp = this.buffer;
    this.buffer = undefined;
    if (this.outstandingOp) {
      this.sendOperation(this.outstandingOp);
    }
  }

  private applyServer(operation: OpSeq) {
    if (this.outstandingOp) {
      const pair = this.outstandingOp.transform(operation)!;
      this.outstandingOp = pair.first();
      operation = pair.second();
      if (this.buffer) {
        const pair = this.buffer.transform(operation)!;
        this.buffer = pair.first();
        operation = pair.second();
      }
    }
    this.applyOperation(operation);
  }

  public applyClient(operation: OpSeq) {
    if (!this.outstandingOp) {
      this.sendOperation(operation);
      this.outstandingOp = operation;
    } else if (!this.buffer) {
      this.buffer = operation;
    } else {
      this.buffer = this.buffer.compose(operation);
    }
    this.transformCursors(operation);
  }

  private sendOperation(operation: OpSeq) {
    const op = operation.to_string();
    this.ws?.send(`{"Edit":{"revision":${this.revision},"operation":${op}}}`);
  }

  private sendInfo() {
    if (this.myInfo) {
      this.ws?.send(`{"ClientInfo":${JSON.stringify(this.myInfo)}}`);
    }
  }

  private sendCursorData() {
    if (!this.buffer) {
      this.ws?.send(`{"CursorData":${JSON.stringify(this.cursorData)}}`);
    }
  }

  private applyOperation(operation: OpSeq) {
    if (operation.is_noop()) return;

    this.ignoreChanges = true;
    const ops: (string | number)[] = JSON.parse(operation.to_string());
    let index = 0;

    for (const op of ops) {
      if (typeof op === "string") {
        const pos = unicodePosition(this.model, index);
        index += unicodeLength(op);
        this.model.pushEditOperations(
          this.options.editor.getSelections(),
          [
            {
              range: {
                startLineNumber: pos.lineNumber,
                startColumn: pos.column,
                endLineNumber: pos.lineNumber,
                endColumn: pos.column,
              },
              text: op,
              forceMoveMarkers: true,
            },
          ],
          () => null,
        );
      } else if (op >= 0) {
        index += op;
      } else {
        const chars = -op;
        var from = unicodePosition(this.model, index);
        var to = unicodePosition(this.model, index + chars);
        this.model.pushEditOperations(
          this.options.editor.getSelections(),
          [
            {
              range: {
                startLineNumber: from.lineNumber,
                startColumn: from.column,
                endLineNumber: to.lineNumber,
                endColumn: to.column,
              },
              text: "",
              forceMoveMarkers: true,
            },
          ],
          () => null,
        );
      }
    }

    this.lastValue = this.model.getValue();
    this.ignoreChanges = false;

    this.transformCursors(operation);
  }

  private transformCursors(operation: OpSeq) {
    for (const data of Object.values(this.userCursors)) {
      data.cursors = data.cursors.map((c) => operation.transform_index(c));
      data.selections = data.selections.map(([s, e]) => [
        operation.transform_index(s),
        operation.transform_index(e),
      ]);
    }
    this.updateCursors();
  }

  private updateCursors() {
    const decorations: editor.IModelDeltaDecoration[] = [];

    for (const [id, data] of Object.entries(this.userCursors)) {
      if (id in this.users) {
        const { color, name } = this.users[id as any];
        generateCssStyles(color);

        for (const cursor of data.cursors) {
          const position = unicodePosition(this.model, cursor);
          decorations.push({
            options: {
              className: `remote-cursor-${color}`,
              stickiness: 1,
              zIndex: 2,
            },
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            },
          });
        }
        for (const selection of data.selections) {
          const position = unicodePosition(this.model, selection[0]);
          const positionEnd = unicodePosition(this.model, selection[1]);
          decorations.push({
            options: {
              className: `remote-selection-${color}`,
              hoverMessage: {
                value: name,
              },
              stickiness: 1,
              zIndex: 1,
            },
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: positionEnd.lineNumber,
              endColumn: positionEnd.column,
            },
          });
        }
      }
    }

    this.oldDecorations = this.model.deltaDecorations(
      this.oldDecorations,
      decorations,
    );
  }

  public onChange(event: editor.IModelContentChangedEvent) {
    if (!this.ignoreChanges) {
      const content = this.lastValue;
      const contentLength = unicodeLength(content);
      let offset = 0;

      let operation = OpSeq.new();
      operation.retain(contentLength);
      event.changes.sort((a, b) => b.rangeOffset - a.rangeOffset);
      for (const change of event.changes) {
        const { text, rangeOffset, rangeLength } = change;
        const initialLength = unicodeLength(content.slice(0, rangeOffset));
        const deletedLength = unicodeLength(
          content.slice(rangeOffset, rangeOffset + rangeLength),
        );
        const restLength =
          contentLength + offset - initialLength - deletedLength;
        const changeOp = OpSeq.new();
        changeOp.retain(initialLength);
        changeOp.delete(deletedLength);
        changeOp.insert(text);
        changeOp.retain(restLength);
        operation = operation.compose(changeOp)!;
        offset += changeOp.target_len() - changeOp.base_len();
      }
      this.applyClient(operation);
      this.lastValue = this.model.getValue();
    }
  }

  private onCursor(event: editor.ICursorPositionChangedEvent) {
    const cursors = [event.position, ...event.secondaryPositions];
    this.cursorData.cursors = cursors.map((p) => unicodeOffset(this.model, p));
  }

  private onSelection(event: editor.ICursorSelectionChangedEvent) {
    const selections = [event.selection, ...event.secondarySelections];
    this.cursorData.selections = selections.map((s) => [
      unicodeOffset(this.model, s.getStartPosition()),
      unicodeOffset(this.model, s.getEndPosition()),
    ]);
  }
}

type UserOperation = {
  id: number;
  operation: any;
};

type CursorData = {
  cursors: number[];
  selections: [number, number][];
};

type ServerMessage = {
  Identity?: number;
  History?: {
    start: number;
    operations: UserOperation[];
  };
  UserInfo?: {
    id: number;
    info: UserInfo | null;
  };
  UserCursor?: {
    id: number;
    data: CursorData;
  };
};

function unicodeLength(str: string): number {
  let length = 0;
  for (const c of str) ++length;
  return length;
}

function unicodeOffset(model: editor.ITextModel, pos: IPosition): number {
  const value = model.getValue();
  const offsetUTF16 = model.getOffsetAt(pos);
  return unicodeLength(value.slice(0, offsetUTF16));
}

function unicodePosition(model: editor.ITextModel, offset: number): IPosition {
  const value = model.getValue();
  let offsetUTF16 = 0;
  for (const c of value) {
    if (offset <= 0) break;
    offsetUTF16 += c.length;
    offset -= 1;
  }
  return model.getPositionAt(offsetUTF16);
}

const generatedStyles = new Set<number>();

function generateCssStyles(color: number) {
  if (!generatedStyles.has(color)) {
    generatedStyles.add(color);
    const css = `
      .monaco-editor .remote-selection-${color} {
        background-color: hsla(${color}, 90%, 80%, 0.5);
      }
      .monaco-editor .remote-cursor-${color} {
        border-left: 2px solid hsl(${color}, 90%, 25%);
      }
    `;
    const element = document.createElement("style");
    const text = document.createTextNode(css);
    element.appendChild(text);
    document.head.appendChild(element);
  }
}

export default Collab;

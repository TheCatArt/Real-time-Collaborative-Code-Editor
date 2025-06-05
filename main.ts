// Types and Interfaces
interface User {
    id: string;
    name: string;
    avatar: string;
    cursor: CursorPosition;
    selection: Selection;
    color: string;
    isOnline: boolean;
    lastActivity: number;
}

interface CursorPosition {
    line: number;
    column: number;
}

interface Selection {
    start: CursorPosition;
    end: CursorPosition;
}

interface Document {
    id: string;
    title: string;
    content: string[];
    language: string;
    createdAt: number;
    lastModified: number;
    version: number;
    collaborators: string[];
}

interface Operation {
    id: string;
    type: OperationType;
    position: CursorPosition;
    content: string;
    length?: number;
    userId: string;
    timestamp: number;
    version: number;
}

enum OperationType {
    INSERT = 'insert',
    DELETE = 'delete',
    RETAIN = 'retain',
    CURSOR = 'cursor',
    SELECTION = 'selection'
}

interface Message {
    type: MessageType;
    payload: any;
    userId: string;
    timestamp: number;
}

enum MessageType {
    USER_JOIN = 'user_join',
    USER_LEAVE = 'user_leave',
    DOCUMENT_CHANGE = 'document_change',
    CURSOR_CHANGE = 'cursor_change',
    SELECTION_CHANGE = 'selection_change',
    CHAT_MESSAGE = 'chat_message',
    VERSION_SYNC = 'version_sync',
    FILE_SAVE = 'file_save',
    LANGUAGE_CHANGE = 'language_change'
}

// Operational Transform Engine
class OperationalTransform {
    static transform(op1: Operation, op2: Operation): [Operation, Operation] {
        if (op1.type === OperationType.INSERT && op2.type === OperationType.INSERT) {
            return this.transformInsertInsert(op1, op2);
        } else if (op1.type === OperationType.INSERT && op2.type === OperationType.DELETE) {
            return this.transformInsertDelete(op1, op2);
        } else if (op1.type === OperationType.DELETE && op2.type === OperationType.INSERT) {
            const [op2Prime, op1Prime] = this.transformInsertDelete(op2, op1);
            return [op1Prime, op2Prime];
        } else if (op1.type === OperationType.DELETE && op2.type === OperationType.DELETE) {
            return this.transformDeleteDelete(op1, op2);
        }
        return [op1, op2];
    }

    private static transformInsertInsert(op1: Operation, op2: Operation): [Operation, Operation] {
        const pos1 = this.positionToIndex(op1.position);
        const pos2 = this.positionToIndex(op2.position);

        if (pos1 < pos2 || (pos1 === pos2 && op1.userId < op2.userId)) {
            return [
                op1,
                {
                    ...op2,
                    position: this.adjustPosition(op2.position, op1.content.length)
                }
            ];
        } else {
            return [
                {
                    ...op1,
                    position: this.adjustPosition(op1.position, op2.content.length)
                },
                op2
            ];
        }
    }

    private static transformInsertDelete(op1: Operation, op2: Operation): [Operation, Operation] {
        const insertPos = this.positionToIndex(op1.position);
        const deletePos = this.positionToIndex(op2.position);
        const deleteLength = op2.length || 0;

        if (insertPos <= deletePos) {
            return [
                op1,
                {
                    ...op2,
                    position: this.adjustPosition(op2.position, op1.content.length)
                }
            ];
        } else if (insertPos > deletePos + deleteLength) {
            return [
                {
                    ...op1,
                    position: this.adjustPosition(op1.position, -deleteLength)
                },
                op2
            ];
        } else {
            return [
                {
                    ...op1,
                    position: { ...op2.position }
                },
                op2
            ];
        }
    }

    private static transformDeleteDelete(op1: Operation, op2: Operation): [Operation, Operation] {
        const pos1 = this.positionToIndex(op1.position);
        const pos2 = this.positionToIndex(op2.position);
        const len1 = op1.length || 0;
        const len2 = op2.length || 0;

        if (pos1 + len1 <= pos2) {
            return [
                op1,
                {
                    ...op2,
                    position: this.adjustPosition(op2.position, -len1)
                }
            ];
        } else if (pos2 + len2 <= pos1) {
            return [
                {
                    ...op1,
                    position: this.adjustPosition(op1.position, -len2)
                },
                op2
            ];
        } else {
            // Overlapping deletes - complex case
            const start1 = pos1;
            const end1 = pos1 + len1;
            const start2 = pos2;
            const end2 = pos2 + len2;

            const newStart = Math.min(start1, start2);
            const newEnd = Math.max(end1, end2);
            const newLength = newEnd - newStart;

            return [
                {
                    ...op1,
                    position: this.indexToPosition(newStart),
                    length: newLength
                },
                {
                    ...op2,
                    type: OperationType.RETAIN,
                    length: 0
                }
            ];
        }
    }

    private static positionToIndex(position: CursorPosition): number {
        // Simplified - in real implementation, this would consider line breaks
        return position.line * 1000 + position.column;
    }

    private static indexToPosition(index: number): CursorPosition {
        return {
            line: Math.floor(index / 1000),
            column: index % 1000
        };
    }

    private static adjustPosition(position: CursorPosition, offset: number): CursorPosition {
        const index = this.positionToIndex(position) + offset;
        return this.indexToPosition(Math.max(0, index));
    }
}

// Syntax Highlighter
class SyntaxHighlighter {
    private static keywords: { [key: string]: string[] } = {
        javascript: ['const', 'let', 'var', 'function', 'class', 'if', 'else', 'for', 'while', 'return', 'import', 'export'],
        typescript: ['const', 'let', 'var', 'function', 'class', 'interface', 'type', 'if', 'else', 'for', 'while', 'return', 'import', 'export'],
        python: ['def', 'class', 'if', 'else', 'elif', 'for', 'while', 'return', 'import', 'from', 'try', 'except'],
        java: ['public', 'private', 'protected', 'class', 'interface', 'if', 'else', 'for', 'while', 'return', 'import'],
        cpp: ['int', 'char', 'float', 'double', 'class', 'struct', 'if', 'else', 'for', 'while', 'return', '#include']
    };

    static highlight(code: string, language: string): string {
        const keywords = this.keywords[language] || [];
        let highlighted = code;

        // Highlight keywords
        keywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            highlighted = highlighted.replace(regex, `<span class="keyword">${keyword}</span>`);
        });

        // Highlight strings
        highlighted = highlighted.replace(/(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="string">$1$2$1</span>');

        // Highlight comments
        if (language === 'javascript' || language === 'typescript' || language === 'java' || language === 'cpp') {
            highlighted = highlighted.replace(/\/\/.*$/gm, '<span class="comment">$&</span>');
            highlighted = highlighted.replace(/\/\*[\s\S]*?\*\//g, '<span class="comment">$&</span>');
        } else if (language === 'python') {
            highlighted = highlighted.replace(/#.*$/gm, '<span class="comment">$&</span>');
        }

        // Highlight numbers
        highlighted = highlighted.replace(/\b\d+\.?\d*\b/g, '<span class="number">$&</span>');

        return highlighted;
    }
}

// WebSocket Manager
class WebSocketManager {
    private ws: WebSocket | null = null;
    private messageQueue: Message[] = [];
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectInterval = 1000;

    constructor(
        private url: string,
        private onMessage: (message: Message) => void,
        private onConnectionChange: (connected: boolean) => void
    ) {}

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);

                this.ws.onopen = () => {
                    console.log('WebSocket connected');
                    this.onConnectionChange(true);
                    this.reconnectAttempts = 0;
                    this.flushMessageQueue();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message: Message = JSON.parse(event.data);
                        this.onMessage(message);
                    } catch (error) {
                        console.error('Failed to parse message:', error);
                    }
                };

                this.ws.onclose = () => {
                    console.log('WebSocket disconnected');
                    this.onConnectionChange(false);
                    this.attemptReconnect();
                };

                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    send(message: Message): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            this.messageQueue.push(message);
        }
    }

    private flushMessageQueue(): void {
        while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
            const message = this.messageQueue.shift();
            if (message) {
                this.ws.send(JSON.stringify(message));
            }
        }
    }

    private attemptReconnect(): void {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
                console.log(`Reconnecting attempt ${this.reconnectAttempts}`);
                this.connect().catch(() => this.attemptReconnect());
            }, this.reconnectInterval * this.reconnectAttempts);
        }
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// Code Editor Component
class CodeEditor {
    private element: HTMLElement;
    private contentElement: HTMLElement;
    private lineNumbersElement: HTMLElement;
    private document: Document;
    private users: Map<string, User> = new Map();
    private currentUser: User;
    private wsManager: WebSocketManager;
    private operationQueue: Operation[] = [];
    private isComposing = false;
    private lastVersion = 0;

    constructor(containerId: string, documentId: string, currentUser: User) {
        this.element = document.getElementById(containerId)!;
        this.currentUser = currentUser;
        this.document = {
            id: documentId,
            title: 'Untitled Document',
            content: [''],
            language: 'javascript',
            createdAt: Date.now(),
            lastModified: Date.now(),
            version: 0,
            collaborators: [currentUser.id]
        };

        this.initialize();
        this.setupWebSocket();
    }

    private initialize(): void {
        this.element.innerHTML = `
      <div class="editor-header">
        <div class="editor-title">
          <input type="text" id="document-title" value="${this.document.title}" />
          <select id="language-selector">
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>
        </div>
        <div class="collaborators" id="collaborators"></div>
        <div class="editor-actions">
          <button id="save-btn">Save</button>
          <button id="share-btn">Share</button>
          <div class="connection-status" id="connection-status">Connecting...</div>
        </div>
      </div>
      <div class="editor-container">
        <div class="editor-sidebar">
          <div class="line-numbers" id="line-numbers"></div>
        </div>
        <div class="editor-main">
          <div class="editor-content" id="editor-content" contenteditable="true"></div>
          <div class="cursors-overlay" id="cursors-overlay"></div>
        </div>
      </div>
      <div class="editor-footer">
        <div class="chat-container">
          <div class="chat-messages" id="chat-messages"></div>
          <div class="chat-input-container">
            <input type="text" id="chat-input" placeholder="Type a message..." />
            <button id="chat-send">Send</button>
          </div>
        </div>
      </div>
    `;

        this.contentElement = document.getElementById('editor-content')!;
        this.lineNumbersElement = document.getElementById('line-numbers')!;

        this.setupEventListeners();
        this.updateLineNumbers();
        this.renderContent();
    }

    private setupEventListeners(): void {
        // Content editing
        this.contentElement.addEventListener('input', this.handleInput.bind(this));
        this.contentElement.addEventListener('keydown', this.handleKeyDown.bind(this));
        this.contentElement.addEventListener('compositionstart', () => this.isComposing = true);
        this.contentElement.addEventListener('compositionend', () => this.isComposing = false);

        // Cursor and selection
        this.contentElement.addEventListener('selectionchange', this.handleSelectionChange.bind(this));
        this.contentElement.addEventListener('click', this.handleCursorChange.bind(this));
        this.contentElement.addEventListener('keyup', this.handleCursorChange.bind(this));

        // Document actions
        document.getElementById('save-btn')!.addEventListener('click', this.saveDocument.bind(this));
        document.getElementById('share-btn')!.addEventListener('click', this.shareDocument.bind(this));
        document.getElementById('document-title')!.addEventListener('change', this.updateTitle.bind(this));
        document.getElementById('language-selector')!.addEventListener('change', this.changeLanguage.bind(this));

        // Chat
        const chatInput = document.getElementById('chat-input')! as HTMLInputElement;
        const chatSend = document.getElementById('chat-send')!;

        chatSend.addEventListener('click', () => this.sendChatMessage(chatInput.value));
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage(chatInput.value);
            }
        });
    }

    private setupWebSocket(): void {
        this.wsManager = new WebSocketManager(
            `ws://localhost:8080/collaborate/${this.document.id}`,
            this.handleWebSocketMessage.bind(this),
            this.handleConnectionChange.bind(this)
        );

        this.wsManager.connect().catch(console.error);
    }

    private handleWebSocketMessage(message: Message): void {
        switch (message.type) {
            case MessageType.USER_JOIN:
                this.addUser(message.payload);
                break;
            case MessageType.USER_LEAVE:
                this.removeUser(message.payload.userId);
                break;
            case MessageType.DOCUMENT_CHANGE:
                this.applyRemoteOperation(message.payload);
                break;
            case MessageType.CURSOR_CHANGE:
                this.updateUserCursor(message.payload);
                break;
            case MessageType.SELECTION_CHANGE:
                this.updateUserSelection(message.payload);
                break;
            case MessageType.CHAT_MESSAGE:
                this.addChatMessage(message.payload);
                break;
            case MessageType.VERSION_SYNC:
                this.syncVersion(message.payload);
                break;
            case MessageType.LANGUAGE_CHANGE:
                this.updateLanguage(message.payload.language);
                break;
        }
    }

    private handleConnectionChange(connected: boolean): void {
        const statusElement = document.getElementById('connection-status')!;
        statusElement.textContent = connected ? 'Connected' : 'Disconnected';
        statusElement.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
    }

    private handleInput(event: InputEvent): void {
        if (this.isComposing) return;

        const selection = window.getSelection()!;
        const range = selection.getRangeAt(0);
        const position = this.getPositionFromRange(range);

        let operation: Operation;

        if (event.inputType === 'insertText' || event.inputType === 'insertCompositionText') {
            operation = {
                id: this.generateOperationId(),
                type: OperationType.INSERT,
                position: position,
                content: event.data || '',
                userId: this.currentUser.id,
                timestamp: Date.now(),
                version: this.document.version
            };
        } else if (event.inputType === 'deleteContentBackward' || event.inputType === 'deleteContentForward') {
            operation = {
                id: this.generateOperationId(),
                type: OperationType.DELETE,
                position: position,
                content: '',
                length: 1,
                userId: this.currentUser.id,
                timestamp: Date.now(),
                version: this.document.version
            };
        } else {
            return;
        }

        this.applyOperation(operation);
        this.broadcastOperation(operation);
    }

    private handleKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Tab') {
            event.preventDefault();
            this.insertText('  '); // Insert 2 spaces for tab
        } else if (event.key === 'Enter') {
            event.preventDefault();
            this.insertText('\n');
        }
    }

    private insertText(text: string): void {
        const selection = window.getSelection()!;
        const range = selection.getRangeAt(0);
        const position = this.getPositionFromRange(range);

        const operation: Operation = {
            id: this.generateOperationId(),
            type: OperationType.INSERT,
            position: position,
            content: text,
            userId: this.currentUser.id,
            timestamp: Date.now(),
            version: this.document.version
        };

        this.applyOperation(operation);
        this.broadcastOperation(operation);
    }

    private handleSelectionChange(): void {
        const selection = window.getSelection()!;
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const start = this.getPositionFromRange(range, true);
        const end = this.getPositionFromRange(range, false);

        this.currentUser.selection = { start, end };

        this.wsManager.send({
            type: MessageType.SELECTION_CHANGE,
            payload: {
                userId: this.currentUser.id,
                selection: this.currentUser.selection
            },
            userId: this.currentUser.id,
            timestamp: Date.now()
        });
    }

    private handleCursorChange(): void {
        const selection = window.getSelection()!;
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const position = this.getPositionFromRange(range);

        this.currentUser.cursor = position;

        this.wsManager.send({
            type: MessageType.CURSOR_CHANGE,
            payload: {
                userId: this.currentUser.id,
                cursor: this.currentUser.cursor
            },
            userId: this.currentUser.id,
            timestamp: Date.now()
        });
    }

    private applyOperation(operation: Operation): void {
        switch (operation.type) {
            case OperationType.INSERT:
                this.insertContent(operation.position, operation.content);
                break;
            case OperationType.DELETE:
                this.deleteContent(operation.position, operation.length || 1);
                break;
        }

        this.document.version++;
        this.document.lastModified = Date.now();
        this.updateLineNumbers();
        this.renderContent();
    }

    private applyRemoteOperation(operation: Operation): void {
        // Transform operation based on pending local operations
        let transformedOp = operation;

        for (const localOp of this.operationQueue) {
            if (localOp.timestamp < operation.timestamp) {
                const [, transformedRemote] = OperationalTransform.transform(localOp, transformedOp);
                transformedOp = transformedRemote;
            }
        }

        this.applyOperation(transformedOp);
    }

    private broadcastOperation(operation: Operation): void {
        this.operationQueue.push(operation);

        this.wsManager.send({
            type: MessageType.DOCUMENT_CHANGE,
            payload: operation,
            userId: this.currentUser.id,
            timestamp: Date.now()
        });

        // Clean up operation queue
        setTimeout(() => {
            this.operationQueue = this.operationQueue.filter(op => op.id !== operation.id);
        }, 5000);
    }

    private insertContent(position: CursorPosition, content: string): void {
        if (position.line >= this.document.content.length) {
            this.document.content.push('');
        }

        const line = this.document.content[position.line];
        const newLine = line.slice(0, position.column) + content + line.slice(position.column);

        if (content.includes('\n')) {
            const lines = newLine.split('\n');
            this.document.content[position.line] = lines[0];
            for (let i = 1; i < lines.length; i++) {
                this.document.content.splice(position.line + i, 0, lines[i]);
            }
        } else {
            this.document.content[position.line] = newLine;
        }
    }

    private deleteContent(position: CursorPosition, length: number): void {
        if (position.line >= this.document.content.length) return;

        const line = this.document.content[position.line];

        if (position.column > 0) {
            const newLine = line.slice(0, position.column - length) + line.slice(position.column);
            this.document.content[position.line] = newLine;
        } else if (position.line > 0) {
            // Delete line break
            const prevLine = this.document.content[position.line - 1];
            this.document.content[position.line - 1] = prevLine + line;
            this.document.content.splice(position.line, 1);
        }
    }

    private renderContent(): void {
        const highlightedContent = this.document.content
            .map(line => SyntaxHighlighter.highlight(line || ' ', this.document.language))
            .join('<br>');

        this.contentElement.innerHTML = highlightedContent;
    }

    private updateLineNumbers(): void {
        const lineCount = this.document.content.length;
        const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);
        this.lineNumbersElement.innerHTML = lineNumbers
            .map(num => `<div class="line-number">${num}</div>`)
            .join('');
    }

    private getPositionFromRange(range: Range, start = true): CursorPosition {
        // Simplified position calculation
        const container = start ? range.startContainer : range.endContainer;
        const offset = start ? range.startOffset : range.endOffset;

        // This is a simplified implementation
        // In a real editor, you'd need more sophisticated position tracking
        return {
            line: 0,
            column: offset
        };
    }

    private addUser(user: User): void {
        this.users.set(user.id, user);
        this.updateCollaboratorsUI();
    }

    private removeUser(userId: string): void {
        this.users.delete(userId);
        this.updateCollaboratorsUI();
    }

    private updateUserCursor(data: { userId: string; cursor: CursorPosition }): void {
        const user = this.users.get(data.userId);
        if (user) {
            user.cursor = data.cursor;
            this.renderUserCursors();
        }
    }

    private updateUserSelection(data: { userId: string; selection: Selection }): void {
        const user = this.users.get(data.userId);
        if (user) {
            user.selection = data.selection;
            this.renderUserSelections();
        }
    }

    private updateCollaboratorsUI(): void {
        const collaboratorsElement = document.getElementById('collaborators')!;
        const avatars = Array.from(this.users.values())
            .map(user => `
        <div class="collaborator-avatar" style="background-color: ${user.color}">
          ${user.name.charAt(0).toUpperCase()}
        </div>
      `)
            .join('');

        collaboratorsElement.innerHTML = avatars;
    }

    private renderUserCursors(): void {
        const cursorsOverlay = document.getElementById('cursors-overlay')!;
        const cursors = Array.from(this.users.values())
            .filter(user => user.id !== this.currentUser.id)
            .map(user => `
        <div class="remote-cursor" style="
          top: ${user.cursor.line * 20}px;
          left: ${user.cursor.column * 8}px;
          border-color: ${user.color};
        ">
          <div class="cursor-label" style="background-color: ${user.color}">
            ${user.name}
          </div>
        </div>
      `)
            .join('');

        cursorsOverlay.innerHTML = cursors;
    }

    private renderUserSelections(): void {
        // Implementation for rendering user selections
        // This would overlay selection highlights for each user
    }

    private sendChatMessage(message: string): void {
        if (!message.trim()) return;

        this.wsManager.send({
            type: MessageType.CHAT_MESSAGE,
            payload: {
                userId: this.currentUser.id,
                userName: this.currentUser.name,
                message: message,
                timestamp: Date.now()
            },
            userId: this.currentUser.id,
            timestamp: Date.now()
        });

        (document.getElementById('chat-input')! as HTMLInputElement).value = '';
    }

    private addChatMessage(data: any): void {
        const chatMessages = document.getElementById('chat-messages')!;
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        messageElement.innerHTML = `
      <div class="message-author">${data.userName}:</div>
      <div class="message-content">${data.message}</div>
      <div class="message-time">${new Date(data.timestamp).toLocaleTimeString()}</div>
    `;

        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    private saveDocument(): void {
        this.wsManager.send({
            type: MessageType.FILE_SAVE,
            payload: {
                document: this.document
            },
            userId: this.currentUser.id,
            timestamp: Date.now()
        });

        // Show save indicator
        const saveBtn = document.getElementById('save-btn')!;
        saveBtn.textContent = 'Saved!';
        setTimeout(() => {
            saveBtn.textContent = 'Save';
        }, 2000);
    }

    private shareDocument(): void {
        const shareUrl = `${window.location.origin}/collaborate/${this.document.id}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert(`Document link copied to clipboard: ${shareUrl}`);
        });
    }

    private updateTitle(event: Event): void {
        const target = event.target as HTMLInputElement;
        this.document.title = target.value;
        this.document.lastModified = Date.now();
    }

    private changeLanguage(event: Event): void {
        const target = event.target as HTMLSelectElement;
        this.document.language = target.value;

        this.wsManager.send({
            type: MessageType.LANGUAGE_CHANGE,
            payload: {
                language: this.document.language
            },
            userId: this.currentUser.id,
            timestamp: Date.now()
        });

        this.renderContent();
    }

    private updateLanguage(language: string): void {
        this.document.language = language;
        (document.getElementById('language-selector')! as HTMLSelectElement).value = language;
        this.renderContent();
    }

    private syncVersion(data: { version: number; content: string[] }): void {
        if (data.version > this.document.version) {
            this.document.version = data.version;
            this.document.content = data.content;
            this.renderContent();
            this.updateLineNumbers();
        }
    }

    private generateOperationId(): string {
        return `${this.currentUser.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Application Bootstrap
class CollaborativeEditorApp {
    private editor: CodeEditor | null = null;

    async initialize(): Promise<void> {
        // Create current user
        const currentUser: User = {
            id: this.generateUserId(),
            name: this.promptUserName(),
            avatar: '',
            cursor: { line: 0, column: 0 },
            selection: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
            color: this.generateUserColor(),
            isOnline: true,
            lastActivity: Date.now()
        };

        // Get or create document ID
        const documentId = this.getDocumentId();

        // Initialize editor
        this.editor = new CodeEditor('editor-container', documentId, currentUser);

        // Load CSS styles
        this.loadStyles();
    }

    private generateUserId(): string {
        return `user_${Math.random().toString(36).substr(2, 9)}`;
    }

    private promptUserName(): string {
        return prompt('Enter your name:') || `User${Math.floor(Math.random() * 1000)}`;
    }

    private generateUserColor(): string {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    private getDocumentId(): string {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('doc') || `doc_${Math.random().toString(36).substr(2, 9)}`;
    }

    private loadStyles(): void {
        const styles = `
      body {
        margin: 0;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        background: #1e1e1e;
        color: #d4d4d4;
      }

      #editor-container {
        height: 100vh;
        display: flex;
        flex-direction: column;
      }

      .editor-header {
        background: #2d2d30;
        padding: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #3e3e42;
      }

      .editor-title input {
        background: transparent;
        border: none;
        color: #d4d4d4;
        font-size: 16px;
        font-weight: bold;
      }

      .editor-title select {
        background: #3c3c3c;
        border: 1px solid #5a5a5a;
        color: #d4d4d4;
        margin-left: 10px;
        padding: 5px;
      }

      .collaborators {
        display: flex;
        gap: 5px;
      }

      .collaborator-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
      }

      .editor-actions {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      .editor-actions button {
        background: #0078d4;
        border: none;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      }

      .connection-status {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
      }

      .connection-status.connected {
        background: #107c10;
        color: white;
      }

      .connection-status.disconnected {
        background: #d13438;
        color: white;
      }

      .editor-container {
        flex: 1;
        display: flex;
        position: relative;
      }

      .editor-sidebar {
        background: #252526;
        border-right: 1px solid #3e3e42;
      }

      .line-numbers {
        padding: 10px;
        font-size: 14px;
        line-height: 20px;
        color: #858585;
        text-align: right;
        min-width: 50px;
      }

      .editor-main {
        flex: 1;
        position: relative;
      }

      .editor-content {
        padding: 10px;
        font-size: 14px;
        line-height: 20px;
        min-height: 100%;
        outline: none;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .cursors-overlay {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        z-index: 100;
      }

      .remote-cursor {
        position: absolute;
        width: 2px;
        height: 20px;
        background: currentColor;
        pointer-events: none;
      }

      .cursor-label {
        position: absolute;
        top: -25px;
        left: 0;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
        white-space: nowrap;
        color: white;
      }

      .editor-footer {
        height: 200px;
        background: #2d2d30;
        border-top: 1px solid #3e3e42;
      }

      .chat-container {
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
      }

      .chat-message {
        margin-bottom: 10px;
        padding: 5px;
        border-radius: 5px;
        background: #3c3c3c;
      }

      .message-author {
        font-weight: bold;
        color: #569cd6;
        font-size: 12px;
      }

      .message-content {
        margin: 5px 0;
      }

      .message-time {
        font-size: 10px;
        color: #858585;
      }

      .chat-input-container {
        display: flex;
        padding: 10px;
        gap: 10px;
      }

      .chat-input-container input {
        flex: 1;
        background: #3c3c3c;
        border: 1px solid #5a5a5a;
        color: #d4d4d4;
        padding: 8px;
        border-radius: 4px;
      }

      .chat-input-container button {
        background: #0078d4;
        border: none;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      }

      /* Syntax highlighting */
      .keyword {
        color: #569cd6;
        font-weight: bold;
      }

      .string {
        color: #ce9178;
      }

      .comment {
        color: #6a9955;
        font-style: italic;
      }

      .number {
        color: #b5cea8;
      }
    `;

        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
}

// Initialize the application
window.addEventListener('DOMContentLoaded', () => {
    const app = new CollaborativeEditorApp();
    app.initialize().catch(console.error);
});

// Export for module usage
export { CollaborativeEditorApp, CodeEditor, OperationalTransform };
import {
  createContext,
  createElement,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type ReactNode,
} from 'react';

import type {
  Diagnostic,
  LayoutDocument,
  LayoutStack,
  ThemeTokens,
} from '@workspace-platform/contracts';
import type {
  PaletteCommandItem,
  RegisteredView,
  ResolvedMode,
  WorkspacePlatform,
} from '@workspace-platform/core';
import {
  computeStackRects,
  computeVisibleDropZones,
  hitTestDropIntent,
  hitTestDropIntentInLayout,
  hitTestStackInLayout,
  type ContainerBounds,
  type DropIntent,
  type StackRect,
  type VisibleDropZone,
} from '@workspace-platform/engine-bounded-grid';

const DEFAULT_GAP = 12;

const rootStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'row',
  gap: DEFAULT_GAP,
  minWidth: 0,
  minHeight: 0,
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  borderRadius: 18,
  boxSizing: 'border-box',
  background:
    'linear-gradient(180deg, var(--wp-surface-canvas, #0f172a) 0%, var(--wp-surface-elevated, #111827) 100%)',
  color: 'var(--wp-text-primary, #e5eefb)',
  border: '1px solid var(--wp-border-subtle, rgba(148, 163, 184, 0.25))',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const columnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: DEFAULT_GAP,
  minWidth: 0,
  minHeight: 0,
  flexBasis: 0,
};

const stackSurfaceBaseStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
  borderRadius: 14,
  border: '1px solid rgba(148, 163, 184, 0.18)',
  background:
    'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(15, 23, 42, 0.9) 100%)',
  boxShadow:
    '0 14px 30px -18px rgba(15, 23, 42, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
};

const tabStripStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 48,
  padding: '8px 10px',
  background: 'rgba(15, 23, 42, 0.62)',
  borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
  overflowX: 'auto',
};

const stackBodyStyle: CSSProperties = {
  position: 'relative',
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  padding: 16,
};

const missingViewStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  alignContent: 'start',
  padding: 16,
  borderRadius: 12,
  border: '1px dashed rgba(248, 113, 113, 0.5)',
  background: 'rgba(127, 29, 29, 0.16)',
};

const dropZoneBaseStyle: CSSProperties = {
  position: 'absolute',
  display: 'grid',
  placeItems: 'center',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'transform 120ms ease, border-color 120ms ease, background 120ms ease',
  backdropFilter: 'blur(10px)',
  zIndex: 20,
};

export interface WorkspaceThemeState {
  themeId?: string;
  tokens?: ThemeTokens;
}

export interface WorkspaceDragState {
  sourceStackId: string | null;
  sourceViewId?: string | null;
  targetStackId?: string | null;
  point?: { x: number; y: number } | null;
}

export interface InspectableSnapshot<TContext> {
  value: string;
  context: TContext;
}

export interface InspectableSnapshotStore<TContext> {
  getSnapshot(): InspectableSnapshot<TContext>;
  subscribe(listener: (snapshot: InspectableSnapshot<TContext>) => void): {
    unsubscribe: () => void;
  };
}

export interface WorkspaceViewComponentProps {
  platform: WorkspacePlatform;
  stackId: string;
  viewId: string;
  modeId: string;
}

export interface MissingViewRenderInput {
  platform: WorkspacePlatform;
  stackId: string;
  viewId: string;
  view?: RegisteredView;
  reason: 'missing-registration' | 'missing-export';
}

export interface WorkspaceViewRenderInput {
  platform: WorkspacePlatform;
  stack: LayoutStack;
  view: RegisteredView;
  component: unknown;
  componentProps: WorkspaceViewComponentProps;
}

export interface WorkspaceDropOverlayState {
  bounds: ContainerBounds;
  stackRects: StackRect[];
  targetStackId?: string;
  zones: VisibleDropZone[];
  activeZoneId?: string;
}

export interface TabStripProps {
  platform: WorkspacePlatform;
  stack: LayoutStack;
  draggingViewId?: string | null;
  onActivateView?: (stackId: string, viewId: string) => void;
  onCloseView?: (stackId: string, viewId: string) => void;
  onStartDragView?: (stackId: string, viewId: string) => void;
  onEndDragView?: () => void;
}

export interface StackSurfaceProps {
  platform: WorkspacePlatform;
  stack: LayoutStack;
  activeMode: string;
  focused?: boolean;
  draggingViewId?: string | null;
  emptyState?: ReactNode;
  onActivateView?: (stackId: string, viewId: string) => void;
  onCloseView?: (stackId: string, viewId: string) => void;
  onFocusStack?: (stackId: string) => void;
  onStartDragView?: (stackId: string, viewId: string) => void;
  onEndDragView?: () => void;
  onDragOverStack?: (
    stackId: string,
    event: ReactDragEvent<HTMLElement>,
  ) => void;
  onDropStack?: (stackId: string, event: ReactDragEvent<HTMLElement>) => void;
  renderView?: (input: WorkspaceViewRenderInput) => ReactNode;
  renderMissingView?: (input: MissingViewRenderInput) => ReactNode;
}

export interface DropZoneOverlayProps {
  zone: VisibleDropZone;
  rootBounds?: ContainerBounds;
  active?: boolean;
  onSelect?: (intent: DropIntent) => void;
}

export interface WorkspaceRootProps {
  platform: WorkspacePlatform;
  layout: LayoutDocument;
  bounds?: Partial<ContainerBounds>;
  activeMode?: string;
  activeTheme?: WorkspaceThemeState;
  focusedStackId?: string | null;
  dragState?: WorkspaceDragState;
  className?: string;
  style?: CSSProperties;
  emptyState?: ReactNode;
  onActivateView?: (stackId: string, viewId: string) => void;
  onCloseView?: (stackId: string, viewId: string) => void;
  onFocusStack?: (stackId: string) => void;
  onSelectDropIntent?: (intent: DropIntent) => void;
  renderView?: (input: WorkspaceViewRenderInput) => ReactNode;
  renderMissingView?: (input: MissingViewRenderInput) => ReactNode;
}

interface WorkspaceChromeContextValue {
  platform: WorkspacePlatform;
  activeMode: string;
  resolvedMode: ResolvedMode;
  theme: { themeId: string; tokens: ThemeTokens };
  focusedStackId: string | null;
}

const WorkspaceChromeContext = createContext<WorkspaceChromeContextValue | null>(
  null,
);

function toFallbackMode(modeId: string): ResolvedMode {
  return {
    id: modeId,
    title: modeId,
    density: modeId === 'minimal' || modeId === 'expert' ? modeId : 'standard',
    enabledViews: [],
    hiddenCommands: [],
    hotkeys: [],
    themeTokens: {},
  };
}

function toCssVariableName(token: string): string {
  const normalized = token
    .trim()
    .replace(/^--/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `--wp-${normalized || 'token'}`;
}

function getActiveViewId(stack: LayoutStack): string | undefined {
  if (stack.activeViewId && stack.viewIds.includes(stack.activeViewId)) {
    return stack.activeViewId;
  }
  return stack.viewIds[0];
}

function isRenderableComponentType(value: unknown): boolean {
  if (typeof value === 'string' || typeof value === 'function') {
    return true;
  }
  return (
    typeof value === 'object' &&
    value !== null &&
    '$$typeof' in (value as Record<string, unknown>)
  );
}

function getViewLabel(view: RegisteredView | undefined, viewId: string): string {
  return view?.title ?? viewId;
}

function getIntentLabel(kind: DropIntent['kind']): string {
  switch (kind) {
    case 'merge':
      return 'Merge';
    case 'split-left':
      return 'Split left';
    case 'split-right':
      return 'Split right';
    case 'split-up':
      return 'Split up';
    case 'split-down':
      return 'Split down';
  }
}

function resolveChromeContext(
  platform: WorkspacePlatform,
  activeMode: string,
  activeTheme?: WorkspaceThemeState,
  focusedStackId: string | null = null,
): WorkspaceChromeContextValue {
  const resolvedMode = platform.resolveMode(activeMode) ?? toFallbackMode(activeMode);
  return {
    platform,
    activeMode,
    resolvedMode,
    theme: {
      themeId: activeTheme?.themeId ?? resolvedMode.themeRef ?? 'light',
      tokens: {
        ...resolvedMode.themeTokens,
        ...(activeTheme?.tokens ?? {}),
      },
    },
    focusedStackId,
  };
}

function useWorkspaceChromeContext(): WorkspaceChromeContextValue {
  const value = useContext(WorkspaceChromeContext);
  if (!value) {
    throw new Error(
      '@workspace-platform/react hooks must be used inside <WorkspaceRoot>.',
    );
  }
  return value;
}

function defaultMissingViewRenderer(input: MissingViewRenderInput): ReactNode {
  return (
    <div data-missing-view={input.viewId} style={missingViewStyle}>
      <strong>
        {input.reason === 'missing-registration'
          ? 'Unknown registered view'
          : 'Missing view export'}
      </strong>
      <span>{input.view?.title ?? input.viewId}</span>
      <code>{input.stackId}</code>
    </div>
  );
}

function defaultViewRenderer(input: WorkspaceViewRenderInput): ReactNode {
  if (isValidElement(input.component)) {
    return input.component;
  }
  if (isRenderableComponentType(input.component)) {
    return createElement(
      input.component as never,
      input.componentProps as never,
    );
  }
  return defaultMissingViewRenderer({
    platform: input.platform,
    stackId: input.stack.id,
    viewId: input.view.id,
    view: input.view,
    reason: 'missing-export',
  });
}

export function themeTokensToCssVariables(tokens: ThemeTokens = {}): CSSProperties {
  const styles: Record<string, string | number> = {};
  for (const [token, value] of Object.entries(tokens)) {
    styles[toCssVariableName(token)] =
      typeof value === 'boolean' ? Number(value) : value;
  }
  return styles as CSSProperties;
}

export function resolveWorkspaceBounds(
  layout: LayoutDocument,
  bounds: Partial<ContainerBounds> = {},
): ContainerBounds {
  const columnCount = Math.max(1, layout.document.columns.length);
  const tallestColumn = Math.max(
    1,
    ...layout.document.columns.map((column) => column.stacks.length),
  );

  return {
    x: bounds.x ?? 0,
    y: bounds.y ?? 0,
    width: bounds.width ?? Math.max(960, columnCount * 320),
    height: bounds.height ?? Math.max(720, tallestColumn * 240),
    gap: bounds.gap ?? DEFAULT_GAP,
  };
}

function toLayoutPoint(
  event: { clientX: number; clientY: number },
  bounds: ContainerBounds,
  rootElement?: HTMLElement | null,
): { x: number; y: number } {
  const rect = rootElement?.getBoundingClientRect();
  const relativeX = rect ? event.clientX - rect.left : event.clientX;
  const relativeY = rect ? event.clientY - rect.top : event.clientY;

  return {
    x: bounds.x + relativeX,
    y: bounds.y + relativeY,
  };
}

export function resolveDropOverlayState(
  layout: LayoutDocument,
  dragState?: WorkspaceDragState,
  bounds: Partial<ContainerBounds> = {},
): WorkspaceDropOverlayState {
  const resolvedBounds = resolveWorkspaceBounds(layout, bounds);
  const stackRects = computeStackRects(layout, resolvedBounds);

  if (!dragState?.sourceStackId) {
    return { bounds: resolvedBounds, stackRects, zones: [] };
  }

  const hoveredTarget = dragState.point
    ? hitTestStackInLayout(
        layout,
        dragState.point,
        resolvedBounds,
        dragState.sourceStackId,
      )
    : undefined;
  const targetStackId = dragState.targetStackId ?? hoveredTarget?.stackId;

  if (!targetStackId || targetStackId === dragState.sourceStackId) {
    return { bounds: resolvedBounds, stackRects, zones: [] };
  }

  const targetRect = stackRects.find((entry) => entry.stackId === targetStackId);
  if (!targetRect) {
    return { bounds: resolvedBounds, stackRects, zones: [] };
  }

  const zones = computeVisibleDropZones(
    layout,
    dragState.sourceStackId,
    targetStackId,
    targetRect.rect,
  ).map((zone) => ({
    ...zone,
    intent: {
      ...zone.intent,
      sourceViewId: dragState.sourceViewId ?? undefined,
    },
  }));

  const activeZoneId = dragState.point
    ? hitTestDropIntent(
        layout,
        dragState.sourceStackId,
        targetStackId,
        targetRect.rect,
        dragState.point,
      )?.intent.zoneId
    : undefined;

  return {
    bounds: resolvedBounds,
    stackRects,
    targetStackId,
    zones,
    activeZoneId,
  };
}

export function useWorkspacePlatform(): WorkspacePlatform {
  return useWorkspaceChromeContext().platform;
}

export function useWorkspaceMode(): ResolvedMode {
  return useWorkspaceChromeContext().resolvedMode;
}

export function useWorkspaceTheme(): { themeId: string; tokens: ThemeTokens } {
  return useWorkspaceChromeContext().theme;
}

export function useFocusedStackId(): string | null {
  return useWorkspaceChromeContext().focusedStackId;
}

export function usePaletteItems(modeId?: string): PaletteCommandItem[] {
  const context = useWorkspaceChromeContext();
  return context.platform.listPaletteItems(modeId ?? context.activeMode);
}

export function useDiagnostics(modeId?: string): Diagnostic[] {
  const context = useWorkspaceChromeContext();
  return context.platform.getDiagnostics(modeId ?? context.activeMode);
}

export function useCommandExecutor(): (
  commandId: string,
  commandContext?: unknown,
) => unknown {
  const context = useWorkspaceChromeContext();
  return useMemo(
    () =>
      (commandId: string, commandContext?: unknown) =>
        context.platform.executeCommand(commandId, commandContext),
    [context.platform],
  );
}

export function useHotkeyResolution(binding: string, scope: string, modeId?: string) {
  const context = useWorkspaceChromeContext();
  return context.platform.resolveHotkey(binding, scope, modeId ?? context.activeMode);
}

export function useInspectableSnapshot<TContext>(
  store?: InspectableSnapshotStore<TContext>,
): InspectableSnapshot<TContext> | undefined {
  const [snapshot, setSnapshot] = useState<InspectableSnapshot<TContext> | undefined>(
    () => store?.getSnapshot(),
  );

  useEffect(() => {
    setSnapshot(store?.getSnapshot());
    if (!store) {
      return () => {};
    }
    return store.subscribe((nextSnapshot) => setSnapshot(nextSnapshot)).unsubscribe;
  }, [store]);

  return snapshot;
}

export function TabStrip({
  platform,
  stack,
  draggingViewId = null,
  onActivateView,
  onCloseView,
  onStartDragView,
  onEndDragView,
}: TabStripProps) {
  const activeViewId = getActiveViewId(stack);

  return (
    <div role="tablist" aria-label={`Tabs for ${stack.id}`} style={tabStripStyle}>
      {stack.viewIds.map((viewId) => {
        const view = platform.getView(viewId);
        const active = viewId === activeViewId;
        const dragging = draggingViewId === viewId;
        const accentColor = view?.accentColorToken
          ? `var(${toCssVariableName(view.accentColorToken)})`
          : 'rgba(96, 165, 250, 0.92)';

        return (
          <div
            key={viewId}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              draggable={Boolean(onStartDragView)}
              data-view-id={viewId}
              data-dragging-view={dragging ? 'true' : 'false'}
              onClick={() => onActivateView?.(stack.id, viewId)}
              onDragStart={(event) => {
                event.dataTransfer?.setData('text/plain', viewId);
                event.dataTransfer?.setData(
                  'application/x-workspace-platform-view-id',
                  viewId,
                );
                if (event.dataTransfer) {
                  event.dataTransfer.effectAllowed = 'move';
                }
                onStartDragView?.(stack.id, viewId);
              }}
              onDragEnd={() => onEndDragView?.()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
                maxWidth: 220,
                padding: '9px 12px',
                borderRadius: 999,
                border: active
                  ? `1px solid ${accentColor}`
                  : '1px solid rgba(148, 163, 184, 0.16)',
                background: active
                  ? 'rgba(15, 23, 42, 0.96)'
                  : 'rgba(15, 23, 42, 0.56)',
                color: active ? 'var(--wp-text-primary, #f8fafc)' : 'rgba(226, 232, 240, 0.78)',
                boxShadow: active
                  ? `inset 0 0 0 1px ${accentColor}55, 0 8px 24px -18px ${accentColor}`
                  : 'none',
                cursor: onStartDragView ? (dragging ? 'grabbing' : 'grab') : 'pointer',
                fontWeight: active ? 700 : 600,
                opacity: dragging ? 0.72 : 1,
              }}
            >
              {view?.icon ? <span aria-hidden="true">{view.icon}</span> : null}
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {getViewLabel(view, viewId)}
              </span>
            </button>
            {onCloseView ? (
              <button
                type="button"
                aria-label={`Close ${getViewLabel(view, viewId)}`}
                data-close-view-id={viewId}
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseView(stack.id, viewId);
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  border: '1px solid rgba(148, 163, 184, 0.16)',
                  background: 'rgba(15, 23, 42, 0.56)',
                  color: 'rgba(226, 232, 240, 0.78)',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function StackSurface({
  platform,
  stack,
  activeMode,
  focused = false,
  draggingViewId = null,
  emptyState,
  onActivateView,
  onCloseView,
  onFocusStack,
  onStartDragView,
  onEndDragView,
  onDragOverStack,
  onDropStack,
  renderView,
  renderMissingView,
}: StackSurfaceProps) {
  const activeViewId = getActiveViewId(stack);

  const surfaceStyle: CSSProperties = {
    ...stackSurfaceBaseStyle,
    outline: focused ? '2px solid rgba(96, 165, 250, 0.9)' : 'none',
    outlineOffset: focused ? -2 : 0,
  };

  let content: ReactNode = emptyState ?? (
    <div style={missingViewStyle}>No active view mounted for {stack.id}.</div>
  );

  if (activeViewId) {
    const view = platform.getView(activeViewId);
    const component = platform.getViewComponent(activeViewId);
    if (!view) {
      content = (renderMissingView ?? defaultMissingViewRenderer)({
        platform,
        stackId: stack.id,
        viewId: activeViewId,
        reason: 'missing-registration',
      });
    } else {
      const componentProps: WorkspaceViewComponentProps = {
        platform,
        stackId: stack.id,
        viewId: activeViewId,
        modeId: activeMode,
      };
      content = (renderView ?? defaultViewRenderer)({
        platform,
        stack,
        view,
        component,
        componentProps,
      });
    }
  }

  return (
    <section
      data-stack-id={stack.id}
      data-focused={focused ? 'true' : 'false'}
      data-active-view-id={activeViewId ?? ''}
      style={surfaceStyle}
      tabIndex={0}
      onMouseDown={() => onFocusStack?.(stack.id)}
      onFocus={() => onFocusStack?.(stack.id)}
      onDragOver={(event) => onDragOverStack?.(stack.id, event)}
      onDrop={(event) => onDropStack?.(stack.id, event)}
    >
      <TabStrip
        platform={platform}
        stack={stack}
        draggingViewId={draggingViewId}
        onActivateView={onActivateView}
        onCloseView={onCloseView}
        onStartDragView={onStartDragView}
        onEndDragView={onEndDragView}
      />
      <div style={stackBodyStyle}>{content}</div>
    </section>
  );
}

export function DropZoneOverlay({
  zone,
  rootBounds,
  active = false,
  onSelect,
}: DropZoneOverlayProps) {
  const offsetX = rootBounds?.x ?? 0;
  const offsetY = rootBounds?.y ?? 0;

  const style: CSSProperties = {
    ...dropZoneBaseStyle,
    left: zone.rect.x - offsetX,
    top: zone.rect.y - offsetY,
    width: zone.rect.width,
    height: zone.rect.height,
    border: active
      ? '2px solid rgba(191, 219, 254, 0.95)'
      : zone.emphasis === 'merge'
        ? '1px solid rgba(96, 165, 250, 0.72)'
        : '1px solid rgba(34, 197, 94, 0.72)',
    background:
      zone.emphasis === 'merge'
        ? active
          ? 'rgba(59, 130, 246, 0.38)'
          : 'rgba(59, 130, 246, 0.2)'
        : active
          ? 'rgba(34, 197, 94, 0.34)'
          : 'rgba(34, 197, 94, 0.18)',
    color: 'var(--wp-text-primary, #eff6ff)',
    transform: active ? 'scale(1.02)' : 'scale(1)',
  };

  return (
    <button
      type="button"
      data-drop-zone-kind={zone.intent.kind}
      data-drop-zone-id={zone.intent.zoneId}
      data-active-zone={active ? 'true' : 'false'}
      aria-label={`${getIntentLabel(zone.intent.kind)} on ${zone.intent.targetStackId}`}
      onClick={() => onSelect?.(zone.intent)}
      style={style}
    >
      {getIntentLabel(zone.intent.kind)}
    </button>
  );
}

export function WorkspaceRoot({
  platform,
  layout,
  bounds,
  activeMode,
  activeTheme,
  focusedStackId = null,
  dragState,
  className,
  style,
  emptyState,
  onActivateView,
  onCloseView,
  onFocusStack,
  onSelectDropIntent,
  renderView,
  renderMissingView,
}: WorkspaceRootProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const internalDragStateRef = useRef<WorkspaceDragState | undefined>(undefined);
  const [internalDragState, setInternalDragState] = useState<
    WorkspaceDragState | undefined
  >(undefined);
  const effectiveDragState = dragState ?? internalDragState;
  const modeId = activeMode ?? layout.activeMode ?? 'standard';
  const chromeContext = useMemo(
    () => resolveChromeContext(platform, modeId, activeTheme, focusedStackId),
    [platform, modeId, activeTheme, focusedStackId],
  );
  const overlayState = useMemo(
    () => resolveDropOverlayState(layout, effectiveDragState, bounds),
    [layout, effectiveDragState, bounds],
  );

  const mergedStyle: CSSProperties = {
    ...rootStyle,
    ...themeTokensToCssVariables(chromeContext.theme.tokens),
    width: overlayState.bounds.width,
    height: overlayState.bounds.height,
    gap: overlayState.bounds.gap ?? DEFAULT_GAP,
    ...style,
  };

  const updateInternalDragState = (
    next:
      | WorkspaceDragState
      | undefined
      | ((current: WorkspaceDragState | undefined) => WorkspaceDragState | undefined),
  ) => {
    const resolved =
      typeof next === 'function'
        ? next(internalDragStateRef.current)
        : next;
    internalDragStateRef.current = resolved;
    setInternalDragState(resolved);
  };

  const handleStartDragView = (sourceStackId: string, sourceViewId: string) => {
    if (dragState !== undefined) {
      return;
    }

    updateInternalDragState({ sourceStackId, sourceViewId });
  };

  const handleEndDragView = () => {
    if (dragState !== undefined) {
      return;
    }

    updateInternalDragState(undefined);
  };

  const handleNativeDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    const currentDragState = internalDragStateRef.current;
    if (dragState !== undefined || !currentDragState?.sourceStackId) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    const point = toLayoutPoint(event, overlayState.bounds, rootRef.current);
    const hoveredStack = hitTestStackInLayout(
      layout,
      point,
      overlayState.bounds,
      currentDragState.sourceStackId,
    );

    updateInternalDragState((current) =>
      current?.sourceStackId
        ? {
            ...current,
            point,
            targetStackId: hoveredStack?.stackId ?? null,
          }
        : current,
    );
  };

  const handleNativeDragOverStack = (
    targetStackId: string,
    event: ReactDragEvent<HTMLElement>,
  ) => {
    const currentDragState = internalDragStateRef.current;
    if (dragState !== undefined || !currentDragState?.sourceStackId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    const point = toLayoutPoint(event, overlayState.bounds, rootRef.current);
    updateInternalDragState((current) =>
      current?.sourceStackId
        ? {
            ...current,
            point,
            targetStackId:
              targetStackId === current.sourceStackId ? null : targetStackId,
          }
        : current,
    );
  };

  const handleNativeDropStack = (
    targetStackId: string,
    event: ReactDragEvent<HTMLElement>,
  ) => {
    const currentDragState = internalDragStateRef.current;
    if (
      dragState !== undefined ||
      !currentDragState?.sourceStackId ||
      targetStackId === currentDragState.sourceStackId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const targetRect = overlayState.stackRects.find(
      (entry) => entry.stackId === targetStackId,
    );
    const preferredPoint =
      currentDragState.point ?? toLayoutPoint(event, overlayState.bounds, rootRef.current);
    const fallbackPoint = targetRect
      ? {
          x: targetRect.rect.x + targetRect.rect.width / 2,
          y: targetRect.rect.y + targetRect.rect.height / 2,
        }
      : preferredPoint;

    const selectedZone = targetRect
      ? hitTestDropIntent(
          layout,
          currentDragState.sourceStackId,
          targetStackId,
          targetRect.rect,
          preferredPoint,
        ) ??
        hitTestDropIntent(
          layout,
          currentDragState.sourceStackId,
          targetStackId,
          targetRect.rect,
          fallbackPoint,
        )
      : undefined;

    if (selectedZone) {
      onSelectDropIntent?.({
        ...selectedZone.intent,
        sourceViewId: currentDragState.sourceViewId ?? undefined,
      });
    }

    updateInternalDragState(undefined);
  };

  const handleNativeDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    const currentDragState = internalDragStateRef.current;
    if (dragState !== undefined || !currentDragState?.sourceStackId) {
      return;
    }

    event.preventDefault();
    const point =
      currentDragState.point ?? toLayoutPoint(event, overlayState.bounds, rootRef.current);
    const targetRect = currentDragState.targetStackId
      ? overlayState.stackRects.find(
          (entry) => entry.stackId === currentDragState.targetStackId,
        )
      : undefined;
    const selectedZone =
      targetRect && currentDragState.targetStackId
        ? hitTestDropIntent(
            layout,
            currentDragState.sourceStackId,
            currentDragState.targetStackId,
            targetRect.rect,
            point,
          )
        : hitTestDropIntentInLayout(
            layout,
            currentDragState.sourceStackId,
            point,
            overlayState.bounds,
          );

    if (selectedZone) {
      onSelectDropIntent?.({
        ...selectedZone.intent,
        sourceViewId: currentDragState.sourceViewId ?? undefined,
      });
    }

    updateInternalDragState(undefined);
  };

  return (
    <WorkspaceChromeContext.Provider value={chromeContext}>
      <div
        ref={rootRef}
        role="application"
        aria-label="Workspace shell"
        className={className}
        data-active-mode={chromeContext.activeMode}
        data-theme-id={chromeContext.theme.themeId}
        data-focused-stack-id={chromeContext.focusedStackId ?? ''}
        data-drag-source-stack-id={effectiveDragState?.sourceStackId ?? ''}
        data-drag-source-view-id={effectiveDragState?.sourceViewId ?? ''}
        data-drag-target-stack-id={effectiveDragState?.targetStackId ?? ''}
        onDragOver={handleNativeDragOver}
        onDrop={handleNativeDrop}
        style={mergedStyle}
      >
        {layout.document.columns.map((column) => (
          <div
            key={column.id}
            data-column-id={column.id}
            style={{
              ...columnStyle,
              flexGrow: column.widthFraction ?? 1,
            }}
          >
            {column.stacks.map((stack) => (
              <div
                key={stack.id}
                style={{
                  display: 'flex',
                  minWidth: 0,
                  minHeight: 0,
                  flexGrow: stack.heightFraction ?? 1,
                  flexBasis: 0,
                }}
              >
                <StackSurface
                  platform={platform}
                  stack={stack}
                  activeMode={chromeContext.activeMode}
                  focused={chromeContext.focusedStackId === stack.id}
                  draggingViewId={
                    effectiveDragState?.sourceStackId === stack.id
                      ? effectiveDragState.sourceViewId ?? null
                      : null
                  }
                  emptyState={emptyState}
                  onActivateView={onActivateView}
                  onCloseView={onCloseView}
                  onFocusStack={onFocusStack}
                  onStartDragView={handleStartDragView}
                  onEndDragView={handleEndDragView}
                  onDragOverStack={handleNativeDragOverStack}
                  onDropStack={handleNativeDropStack}
                  renderView={renderView}
                  renderMissingView={renderMissingView}
                />
              </div>
            ))}
          </div>
        ))}
        {overlayState.zones.map((zone) => (
          <DropZoneOverlay
            key={zone.intent.zoneId}
            zone={zone}
            rootBounds={overlayState.bounds}
            active={zone.intent.zoneId === overlayState.activeZoneId}
            onSelect={onSelectDropIntent}
          />
        ))}
      </div>
    </WorkspaceChromeContext.Provider>
  );
}

export type {
  ContainerBounds,
  DropIntent,
  StackRect,
  VisibleDropZone,
} from '@workspace-platform/engine-bounded-grid';

# Paint MiniUp

A simple Paint-style workspace for rough sketches, screenshots, visual notes, and explaining software ideas. Sketch and annotate here; use the finished image anywhere you like. No AI integration or complicated design system required.

## Quick start

- **Sketch:** Choose Paintbrush or Pencil. Enable **Tidy rough shapes** when you want approximate straight lines, rectangles, and circles cleaned up after a stroke. Leave it off for freehand doodling.
- **Shapes:** Draw rectangles, ellipses, polygons, smooth closed outlines, arrows, lines, and Bézier/spline curves. Use **Finish** or Enter to commit a shape.
- **Notes:** Choose **Notes** (J), then **Numbered callout** or **Sticky note**. Click the canvas to place one, type multiple lines, and click outside or choose Finish. Use Select, then double-click a note to edit it. Drag a selected callout's yellow target handle to move just its pointer.
- **Flow labels:** Select Line, Arrow, or Curve and enter a short **Label** in the toolbar. The label stays with the line when moved, copied, exported, or saved.
- **Screenshots:** Open an image in its own tab, paste with Ctrl/⌘+V as a movable overlay, or drag an image directly onto the canvas. Drop a file outside the canvas to open it as an image.
- **Selection:** Click an object, Shift-click to add/remove items, or Shift-drag a box around objects. On touch, turn on **Multi-select**. Move, resize, duplicate, group, or ungroup the selection. **Snap** draws temporary alignment guides.
- **Export:** Export a flattened annotated PNG or save an editable project in the browser. Export PNG when sharing the result with another person or an AI coding assistant.

## Useful shortcuts

| Action | Shortcut |
|---|---|
| Select | V |
| Paintbrush / Pencil | P / N |
| Notes | J |
| Text | T |
| Arrow / Line / Curve | A / L / U |
| Shapes | S |
| Select additional objects | Shift + click |
| Select objects inside an area | Shift + drag empty canvas |
| Duplicate selection | Ctrl/⌘ + D |
| Group / ungroup | Ctrl/⌘ + G / Ctrl/⌘ + Shift + G |
| Select all editable objects | Ctrl/⌘ + A |
| Nudge selection | Arrow keys; Shift + arrow for 10 px |
| Duplicate by dragging | Alt + drag |
| Finish polygon or curve | Enter |
| Undo / Redo | Ctrl/⌘ + Z / Ctrl/⌘ + Y |
| Paste screenshot | Ctrl/⌘ + V |
| Cancel drawing or clear selection | Esc |

The app also supports touch drawing, pinch-to-zoom, and larger mobile transform handles. Browser-saved projects are stored locally; export important images as files.

### Security note

Blur and pixelate are for visual annotation, not secure redaction. For sensitive information, use solid redaction and export a flattened PNG. Do not distribute an editable source project containing information that must remain hidden.

## Lightweight layers

Click **▤ Layers** in the toolbar (or **Windows → Layers**) to open a separate floating panel. It is hidden by default.

- **Add / Add below:** Make a blank drawing layer above or below the selected layer.
- **Rename:** Choose Rename or double-click a layer name.
- **Show / Hide:** Toggle the eye indicator; hidden contents are excluded from PNG/JPG exports.
- **Lock / Unlock:** Prevent drawing, selection or deletion on that layer. The initial Background layer is locked to protect imported images. Unlock it to edit its pixels.
- **Move layers:** Drag layer rows or use ↑ Above / ↓ Below to change which content appears in front.
- **Opacity:** Fade an entire layer without changing the colors of individual objects.
- **Duplicate:** Create an editable copy of a drawing layer and its objects.
- **Select all:** Select all objects on a visible, unlocked layer.
- **Move selection to:** Send selected objects to any other editable layer.
- **Solo / Show all:** Temporarily isolate the active layer without changing saved visibility settings.
- **Clear / Delete:** Erase a layer's contents or delete the layer (with confirmation if it has contents). The Background layer is preserved.
- **Merge down:** Combine two adjacent unlocked, visible layers at 100% opacity. Layers with erase operations are protected against unsafe merges; use Image → Flatten when necessary.

Pasted screenshots become their own editable **Screenshot** layer beneath the current drawing layer. Adjust the image, then lock its layer to draw notes and arrows on top. The editor still works without opening the Layers panel: ordinary drawing goes to the active Sketch layer.

**Layers are saved** in browser projects, along with visibility, lock state, order, opacity, and object assignments; Undo/Redo also restores layer changes. Export combines only visible layers. Destructive image transforms and Flatten create a new raster background from the visible result; use Undo to recover editable layers.

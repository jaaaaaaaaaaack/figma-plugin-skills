// Main thread — runs in Figma's plugin sandbox.
// Has access to `figma.*`. No DOM, no fetch. See references/plugin-api.md.

figma.showUI(__html__, { width: 320, height: 240, themeColors: true });

figma.ui.onmessage = async (msg) => {
  if (msg.type === "create-rectangles") {
    const nodes: SceneNode[] = [];
    for (let i = 0; i < msg.count; i++) {
      const rect = figma.createRectangle();
      rect.x = i * 150;
      rect.fills = [{ type: "SOLID", color: { r: 1, g: 0.5, b: 0 } }];
      figma.currentPage.appendChild(rect);
      nodes.push(rect);
    }
    figma.currentPage.selection = nodes;
    figma.viewport.scrollAndZoomIntoView(nodes);
  }

  if (msg.type === "close") {
    figma.closePlugin();
  }
};

// Widget — runs JSX-like code rendered to canvas. NOT React.
// See references/widget-api.md for full reference.

const { widget } = figma;
const { AutoLayout, Text, useSyncedState, usePropertyMenu } = widget;

function Counter() {
  const [count, setCount] = useSyncedState<number>("count", 0);

  usePropertyMenu(
    [{ itemType: "action", propertyName: "reset", tooltip: "Reset" }],
    ({ propertyName }) => {
      if (propertyName === "reset") setCount(0);
    }
  );

  return (
    <AutoLayout
      verticalAlignItems="center"
      spacing={12}
      padding={16}
      cornerRadius={12}
      fill="#FFFFFF"
      stroke="#E6E6E6"
      onClick={() => setCount(count + 1)}
    >
      <Text fontSize={24} fontWeight={600}>
        {count}
      </Text>
      <Text fontSize={14} fill="#666">
        Click to increment
      </Text>
    </AutoLayout>
  );
}

widget.register(Counter);

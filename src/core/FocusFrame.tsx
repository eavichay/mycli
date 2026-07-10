import React from "react";

export interface FocusFrameProps {
  title: string;
  children?: React.ReactNode;
}

/**
 * Framed/highlighted visual treatment for any extension's focus view, no
 * animation (FR-013). This is the pattern every future extension reuses.
 */
export function FocusFrame(props: FocusFrameProps): React.ReactNode {
  return (
    <box border borderStyle="double" borderColor="cyan" title={props.title} flexGrow={1} padding={1}>
      {props.children}
    </box>
  );
}

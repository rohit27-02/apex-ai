/* eslint-disable @typescript-eslint/no-explicit-any */

declare module '@base-ui/react/button' {
  const Button: React.ComponentType<any>;
  namespace Button {
    type Props = any;
  }
  export { Button };
}

declare module '@base-ui/react/merge-props' {
  export function mergeProps<T>(...args: any[]): T;
}

declare module '@base-ui/react/use-render' {
  export function useRender(config: any): React.ReactElement;
  namespace useRender {
    type ComponentProps<T> = any;
  }
}

declare module '@base-ui/react/switch' {
  namespace Switch {
    const Root: React.ComponentType<any>;
    const Thumb: React.ComponentType<any>;
    namespace Root {
      type Props = any;
    }
  }
  export { Switch };
}

declare module '@base-ui/react/select' {
  namespace Select {
    const Root: React.ComponentType<any>;
    const Trigger: React.ComponentType<any>;
    const Value: React.ComponentType<any>;
    const Content: React.ComponentType<any>;
    const Item: React.ComponentType<any>;
    const ItemText: React.ComponentType<any>;
    const ItemIndicator: React.ComponentType<any>;
    const Group: React.ComponentType<any>;
    const GroupLabel: React.ComponentType<any>;
    const Separator: React.ComponentType<any>;
    const Portal: React.ComponentType<any>;
    const Positioner: React.ComponentType<any>;
    const Popup: React.ComponentType<any>;
    const Icon: React.ComponentType<any>;
    const List: React.ComponentType<any>;
    const ScrollUpArrow: React.ComponentType<any>;
    const ScrollDownArrow: React.ComponentType<any>;
    namespace Root { type Props = any; }
    namespace Trigger { type Props = any; }
    namespace Value { type Props = any; }
    namespace Popup { type Props = any; }
    namespace Positioner { type Props = any; }
    namespace Group { type Props = any; }
    namespace GroupLabel { type Props = any; }
    namespace Item { type Props = any; }
    namespace ItemText { type Props = any; }
    namespace ItemIndicator { type Props = any; }
    namespace Separator { type Props = any; }
    namespace ScrollUpArrow {}
    namespace ScrollDownArrow {}
  }
  export { Select };
}

declare module '@base-ui/react/tooltip' {
  namespace Tooltip {
    const Root: React.ComponentType<any>;
    const Trigger: React.ComponentType<any>;
    const Portal: React.ComponentType<any>;
    const Positioner: React.ComponentType<any>;
    const Popup: React.ComponentType<any>;
    const Arrow: React.ComponentType<any>;
    const Provider: React.ComponentType<any>;
    namespace Root { type Props = any; }
    namespace Trigger { type Props = any; }
    namespace Provider { type Props = any; }
    namespace Popup { type Props = any; }
    namespace Positioner { type Props = any; }
  }
  export { Tooltip };
}

declare module '@base-ui/react/scroll-area' {
  namespace ScrollArea {
    const Root: React.ComponentType<any>;
    const Viewport: React.ComponentType<any>;
    const Scrollbar: React.ComponentType<any>;
    const Thumb: React.ComponentType<any>;
    const Corner: React.ComponentType<any>;
    namespace Root { type Props = any; }
    namespace Scrollbar { type Props = any; }
  }
  export { ScrollArea };
}

declare module '@base-ui/react/input' {
  const Input: React.ComponentType<any>;
  export { Input };
}

declare module '@base-ui/react/separator' {
  const Separator: React.ComponentType<any>;
  namespace Separator {
    type Props = any;
  }
  export { Separator };
}

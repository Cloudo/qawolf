import * as types from "@qawolf/types";
import { getClickableAncestor } from "./element";
import { nodeToDocSelector } from "./serialize";

type EventCallback = types.Callback<types.ElementEvent>;

export class Recorder {
  private _attribute: string;
  private _id: number;
  private _onDispose: types.Callback[] = [];
  private _pageIndex: number;
  private _sendEvent: EventCallback;

  constructor(attribute: string, pageIndex: number, sendEvent: EventCallback) {
    this._attribute = attribute;
    this._id = Date.now();
    this._pageIndex = pageIndex;
    this._sendEvent = sendEvent;
    this.recordEvents();

    console.debug(`qawolf: Recorder ${this._id} created`);
  }

  public dispose() {
    this._onDispose.forEach(d => d());
    console.debug(`qawolf: Recorder ${this._id} disposed`);
  }

  private listen<K extends keyof DocumentEventMap>(
    eventName: K,
    handler: (ev: DocumentEventMap[K]) => any
  ) {
    document.addEventListener(eventName, handler, {
      capture: true,
      passive: true
    });

    this._onDispose.push(() =>
      document.removeEventListener(eventName, handler)
    );
  }

  private recordEvent<K extends keyof DocumentEventMap>(
    eventName: K,
    handler: (ev: DocumentEventMap[K]) => types.ElementEvent | undefined
  ) {
    this.listen(eventName, (ev: DocumentEventMap[K]) => {
      const event = handler(ev);
      if (!event) return;

      console.debug(
        `qawolf: Recorder ${this._id}: ${eventName} event`,
        ev,
        ev.target,
        "recorded:",
        event
      );
      this._sendEvent(event);
    });
  }

  private recordEvents() {
    this.recordEvent("click", event => {
      // getClickableAncestor chooses the top most clickable ancestor.
      // The ancestor is likely a better target than the descendant.
      // Ex. when you click on the i (button > i) or rect (a > svg > rect)
      // chances are the ancestor (button, a) is a better target to find.
      // XXX if anyone runs into issues with this behavior we can allow disabling it from a flag.
      const target = getClickableAncestor(event.target as HTMLElement);

      return {
        isTrusted: event.isTrusted,
        name: "click",
        page: this._pageIndex,
        target: nodeToDocSelector(target),
        time: Date.now()
      };
    });

    this.recordEvent("input", event => {
      const element = event.target as HTMLInputElement;

      // ignore input events not on selects
      if (element.tagName.toLowerCase() !== "select") return;

      return {
        isTrusted: event.isTrusted,
        name: "input",
        page: this._pageIndex,
        target: nodeToDocSelector(element),
        time: Date.now(),
        value: element.value
      };
    });

    this.recordEvent("keydown", event => ({
      isTrusted: event.isTrusted,
      name: "keydown",
      page: this._pageIndex,
      target: nodeToDocSelector(event.target as HTMLElement),
      time: Date.now(),
      value: event.key
    }));

    this.recordEvent("keyup", event => ({
      isTrusted: event.isTrusted,
      name: "keyup",
      page: this._pageIndex,
      target: nodeToDocSelector(event.target as HTMLElement),
      time: Date.now(),
      value: event.key
    }));

    this.recordEvent("paste", event => {
      if (!event.clipboardData) return;

      return {
        isTrusted: event.isTrusted,
        name: "paste",
        page: this._pageIndex,
        target: nodeToDocSelector(event.target as HTMLElement),
        time: Date.now(),
        value: event.clipboardData.getData("text")
      };
    });

    this.recordScrollEvent();
  }

  private recordScrollEvent() {
    let lastWheelEvent: WheelEvent | null = null;
    this.listen("wheel", ev => (lastWheelEvent = ev));

    // We record the scroll event and not the wheel event
    // because it fires after the element.scrollLeft & element.scrollTop are updated
    this.recordEvent("scroll", event => {
      if (!lastWheelEvent || event.timeStamp - lastWheelEvent.timeStamp > 100) {
        // We record mouse wheel initiated scrolls only
        // to avoid recording system initiated scrolls (after selecting an item/etc).
        // This will not capture scrolls triggered by the keyboard (PgUp/PgDown/Space)
        // however we already record key events so that encompasses those.
        console.debug("qawolf: ignore non-wheel scroll event", event);
        return;
      }

      let element = event.target as HTMLElement;
      if (event.target === document || event.target === document.body) {
        element = (document.scrollingElement ||
          document.documentElement) as HTMLElement;
      }

      return {
        isTrusted: event.isTrusted,
        name: "scroll",
        page: this._pageIndex,
        target: nodeToDocSelector(element),
        time: Date.now(),
        value: {
          x: element.scrollLeft,
          y: element.scrollTop
        }
      };
    });
  }
}

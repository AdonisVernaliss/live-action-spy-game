import { goto } from "$app/navigation";
import { devNotiStore, lobbyStore } from "./stores";

// Return an array of `amount` numbers of which AT LEAST two sum up to 100
export function makeNumberListWith100Sum(amount: number): number[] {
  if (!Number.isInteger(amount) || amount < 2 || amount > 99) {
    throw new RangeError("amount must be an integer between 2 and 99");
  }

  // Avoid 50 + 50: the list contains unique values, so that pair would only
  // render one selectable button and could leave the round unsolvable.
  const firstPart = getRandomInt(1, 49);
  const secondPart = 100 - firstPart;

  // Generate the list of `amount` random unique numbers
  const setOfNumbers = new Set<number>();

  setOfNumbers.add(firstPart);
  setOfNumbers.add(secondPart);

  while (setOfNumbers.size < amount) {
    setOfNumbers.add(getRandomInt(1, 99));
  }

  let listOfNumbers = Array.from(setOfNumbers.values());
  shuffleArray(listOfNumbers);
  return listOfNumbers;
}

// Return a random whole number between `min` and `max`
export function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shuffleArray(array: number[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // Generate a random index between 0 and i

    // Swap elements at i and j
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Halt execution for `timeMs` miliseconds.
export function asyncSleep(timeMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, timeMs);
  });
}

// Start the phone's NFC scanner and give the user `timeoutSecs` seconds to scan an NFC tag.
// Returns the contents of the NFC tag as a string, or null if the user did not scan a tag in time.
export function scanNfc(
  options: { timeOutSecs: number } = { timeOutSecs: 10 }
): [cancel: () => void, promise: Promise<string | null>] {
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };

  async function scan(): Promise<string | null> {
    try {
      let message = null;
      const ndef = new NDEFReader();
      await ndef.scan();
      devNotiStore.set("Scanner on");
      // return new Promise((resolve, reject) => {
      ndef.onreadingerror = (err) => {
        devNotiStore.set(err.toString());
        console.error(`Cannot read data from the NFC tag: ${err}`);
        return null;
      };
      ndef.onreading = (event) => {
        let msg = ``;
        const textDecoder = new TextDecoder();
        event.message.records.forEach((m) => {
          msg += textDecoder.decode(m.data);
        });
        // Got a message from an NFC tag, so return the message
        message = msg;
      };
      // Keep scanning for `timeoutSecs` seconds, checking every 0.5 secs
      // Stop scanning if we hit the timeout limit or if scanning cancelled by the user
      let timer = options.timeOutSecs * 1000; // to miliseconds
      while (!cancelled && timer > 0 && message == null) {
        await asyncSleep(300);
        timer -= 300;
      }
      return message;
    } catch (err) {
      if (err instanceof Error) console.error(err.toString());
      else console.error(`Unknown error occurred while activating NFC reader`);
      return null;
    }
  }
  return [cancel, scan()];
}

export function deviceIsSupported(): boolean {
  // Web NFC is optional: QR links are the cross-platform interaction method.
  return typeof window !== "undefined";
}

// NFC tags are written as the same /scan URL that is encoded in the printed QR.
// Older plain-text tags remain supported for backwards compatibility.
export function normalizeScanTag(contents: string): string {
  const value = contents.trim();

  try {
    const url = new URL(value, window.location.origin);
    const tag = url.searchParams.get("tag");
    if (tag && (url.pathname === "/scan" || value.startsWith("http"))) {
      return tag.trim();
    }
  } catch {
    // Plain task/player/firewall tags are valid and returned unchanged below.
  }

  return value;
}

// Navigate to a page and replace browser history, preventing use of the back button
export function gotoReplace(link: string) {
  goto(link, { replaceState: true });
}

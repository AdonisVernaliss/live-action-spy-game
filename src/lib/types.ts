import type { NFC_ACTIVITIES } from "./consts";

export type Lobby = {
  id: string;
  players: { [K in Color]: Player };
  creator: string;
  status:
  | { state: "settingRooms" }
  | { state: "inLobby"; readyPlayers: { [K in Color]: boolean } }
  | { state: "roleExplanation"; countDown: number }
  | { state: "started"; countDown: number }
  | {
    state: "meetingCalled";
    type: "emergency" | "bodyFound";
    caller: Color;
    presentPlayers: { [K in Color]: boolean };
    // is null when meeting is emergency
    deadPlayer: Color | null;
  }
  | {
    state: "meeting";
    type: "emergency" | "bodyFound";
    caller: Color;
    countDown: number;
    votes: { [K in Color]: Vote };
    nVoters: number;
  }
  | {
    state: "voteResultAnnounced";
    votedOutPlayer: string | null;
    votes: { [K in Color]: Vote };
    countDown: number;
  }
  | { state: "gameEnded"; victors: "impostor" | "crew"; reason: string };
  // Between 0 and 100. At 100, crew win the game.
  // Has a displayed value and a real value.
  // Displayed value may differ from the actual value.
  taskProgression: {
    real: number;
    displayed: number;
  };
  activities: NfcActivities;
  activeEffects: ActiveEffects;
  testMode: {
    enabled: boolean;
  };
  pause: {
    active: boolean;
    startedAt: number | null;
  };
  taskStations: TaskStationView[];
  playerSync: PlayerSyncView;
  virusScan:
  | { state: "inactive" }
  | {
    state: "active";
    prepareRemainingMs: number;
    scanRemainingMs: number;
    deadlineRemainingMs: number;
    paused: boolean;
  };
};

export type TaskStationView = {
  key: string;
  taskNumber: number;
  taskTag?: string;
  playerColor: Color;
  playerName: string;
  remainingMs: number;
};

export type PlayerSyncView =
  | { state: "required" }
  | {
    state: "completed";
    partnerColor: Color | null;
    completedAt: number | null;
  }
  | {
    state: "waiting" | "incoming";
    partnerColor: Color;
    partnerName: string;
    expiresAt: number;
  }
  | {
    state: "active";
    sessionId: string;
    partnerColor: Color;
    partnerName: string;
    startedAt: number;
    endsAt: number;
    durationMs: number;
  };

export type Player = {
  id: string;
  name: string;
  connection: "connected" | "disconnected" | "simulated";
  isSimulated: boolean;
  isHostOnly: boolean;
  status: "alive" | "dead" | "foundDead";
  role:
  | { name: "crew" }
  | { name: "impostor"; killCooldown: number; sabotageCooldown: number }
  | { name: "undecided" };
  emergencyMeetingsLeft: number;
  taskLockedUntil: number;
  syncTask: {
    required: boolean;
    completed: boolean;
    partnerColor: Color | null;
    completedAt: number | null;
  };
  color: Color;
  tasks: Task[];
  currentlyDoing:
  | {
    activity: "task";
    number: number;
    taskTag?: string;
  }
  | {
    activity: "nothing";
  }
  | {
    activity: "fixFirewall";
    number: 0 | 1;
    readyAt: number;
    readyInMs: number;
  }
  | {
    activity: "awaitingSync";
    requestId: string;
    targetColor: Color;
  }
  | {
    activity: "playerSync";
    sessionId: string;
    partnerColor: Color;
  };
};

// A room has a name and one or more activities (NFC tags)
export type NfcActivities = {
  [name: string]: {
    id: number;
    room: string;
    name: (typeof NFC_ACTIVITIES)[number];
  };
};

// `null` means the effect is not active
export type ActiveEffects = {
  hacked: { affectedPlayers: Color[]; countDown: number } | null;
  firewallBreach: {
    buttonsPressed: {
      firewallbutton1: boolean;
      firewallbutton2: boolean;
    };
    countDown: number;
  } | null;
};

// Each player has one of these colors assigned to them
export type Color =
  | "green"
  | "blue"
  | "yellow"
  | "pink"
  | "red"
  | "orange"
  | "purple"
  | "black"
  | "white"
  | "cyan"
  | "lime"
  | "brown"
  | "gray"
  | "navy"
  | "maroon";

export type Task = {
  name: string;
  number: number;
  description: string;
  descriptionEn?: string;
  status: "available" | "completed";
  completedCheckpoints?: string[];
};

// Game actions taken by players that the frontend needs to communicate to the backend
export type GameAction =
  | {
    action: "callMeeting";
  }
  | {
    action: "reportDeadBody";
    bodyColor: Color;
  }
  // Enter the currently called meeting
  | { action: "enterMeeting" }
  | {
    action: "vote";
    vote: Vote;
  }
  | {
    action: "killPlayer";
    targetColor: Color;
  }
  | {
    action: "silentKillPlayer";
    targetColor: Color;
  }
  | {
    action: "beginSilentEliminationHold";
    targetColor: Color;
  }
  | { action: "cancelSilentEliminationHold" }
  | {
    action: "requestPlayerSync";
    targetColor: Color;
    mode: "sync";
  }
  | { action: "cancelPlayerSync" }
  | {
    action: "startTask";
    taskNumber: number;
    taskTag?: string;
  }
  | {
    action: "startFirewallFix";
    number: number;
  }
  | {
    action: "taskCompleted";
    taskNumber: number;
    taskTag?: string;
  }
  | {
    action: "toggleAgentTask";
    taskNumber: number;
  }
  | {
    action: "finishFirewallFix";
    number: number;
  }
  // Player ready in lobby
  | { action: "playerReady" }
  | {
    action: "launchSabotage";
    sabotage:
      | { kind: "firewallBreach" }
      | { kind: "hackPlayer"; target: Color }
      | { kind: "virusScan" };
  }
  | {
    action: "clearCurrentActivity";
  }
  | {
    action: "virusScanFailed";
  }
  | {
    action: "virusScanCompleted";
  };

export type GameActionResult =
  | {
      success: true;
      action: GameAction["action"];
      taskComplete?: boolean;
      wiretapProgress?: number;
    }
  | {
      success: false;
      action: GameAction["action"] | "unknown";
      code: string;
      message: string;
    };

export type Vote = Color | "noVote" | "skip";

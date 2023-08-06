import { Account, Provider } from "@flat-peak/javascript-sdk";
import { SharedState } from "./models/shared-state";

export interface RequestLocals {
  state: SharedState;
  account: Account;
  provider: Provider;
}

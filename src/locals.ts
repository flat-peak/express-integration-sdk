import { Account, Provider } from "@flat-peak/javascript-sdk";
import { SharedStateData } from "./types";

export interface RequestLocals {
  state: SharedStateData;
  account: Account;
  provider: Provider;
}

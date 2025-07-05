import { IElectronAPI } from "../../../types/electron";

declare global {
  interface Window {
    api: IElectronAPI;
  }
}

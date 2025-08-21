declare global {
  interface Window {
    __TAURI__?: {
      event?: {
        listen: (ev: string, cb: (payload: any) => void) => Promise<() => void> | void;
      };
      core?: { invoke?: (cmd: string, args?: any) => Promise<any> };
    };
    __notice_bound?: boolean;
  }
}
export {};

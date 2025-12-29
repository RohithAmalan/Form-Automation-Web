export interface AutomationLogger {
    log: (msg: string, type: 'info' | 'error' | 'action' | 'warning' | 'success', details?: any) => Promise<void>;
}

export interface JobControls {
    checkPause: () => Promise<void>;
    askUser: (type: 'file' | 'text', label: string) => Promise<string | null>;
    saveLearnedData: (key: string, value: string) => Promise<void>;
}

export interface JobParams extends JobControls {
    jobId: string;
    url: string;
    profileData: any;
    logger: AutomationLogger;
}

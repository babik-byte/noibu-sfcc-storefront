import { useEffect, type ReactNode, type ReactElement } from 'react';
import { addAdapter } from '@/lib/adapters/adapter-store';
import { createNoibuAdapter, NOIBU_ADAPTER_NAME } from '../adapters/noibu-adapter';

export interface NoibuProviderProps {
    children: ReactNode;
}

/**
 * Injects the Noibu script and registers the Noibu engagement adapter.
 * React 19 hoists the <script src> to <head> and deduplicates by src.
 * MUST be default export for extension system dynamic imports.
 */
export default function NoibuProvider({ children }: NoibuProviderProps): ReactElement {
    useEffect(() => {
        addAdapter(NOIBU_ADAPTER_NAME, createNoibuAdapter({}));
    }, []);

    return (
        <>
            <script async src="https://cdn.noibu.com/collect-core.js" />
            {children}
        </>
    );
}

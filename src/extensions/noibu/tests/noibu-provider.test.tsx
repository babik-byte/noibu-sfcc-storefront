import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import NoibuProvider from '../providers/noibu-provider';

describe('NoibuProvider', () => {
    it('renders children', () => {
        const { getByText } = render(
            <NoibuProvider>
                <span>test content</span>
            </NoibuProvider>,
        );
        expect(getByText('test content')).toBeTruthy();
    });

    it('renders Noibu script tag', () => {
        render(
            <NoibuProvider>
                <span />
            </NoibuProvider>,
        );
        // React 19 hoists <script src> to <head> — query document, not container
        const script = document.querySelector('script[src="https://cdn.noibu.com/collect-core.js"]');
        expect(script).toBeTruthy();
        expect(script?.hasAttribute('async')).toBe(true);
    });
});

import { test, expect } from 'vitest'
import { render } from '@testing-library/svelte';

import View from '../src/lib/View.svelte'

test('App', () => {
    expect(render(View)).toBeDefined()
});
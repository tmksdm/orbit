import { render } from '@testing-library/react-native';

import IndexScreen from '../src/app/index';

describe('Stage 0 placeholder screen', () => {
  it('renders the Orbit Stage 0 placeholder', async () => {
    const { getByText } = await render(<IndexScreen />);
    expect(getByText('Orbit')).toBeTruthy();
    expect(getByText('Stage 0 — project foundation')).toBeTruthy();
  });
});

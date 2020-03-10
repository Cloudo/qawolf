import React from 'react';
import Argument from '../Argument';

function ArgumentRepl() {
  return (
    <React.Fragment>
      <Argument
        description={
          <React.Fragment>
            Pass variables you want to access in the REPL. Includes the{' '}
            <a href="https://github.com/microsoft/playwright/blob/master/docs/api.md#class-browser">
              Playwright <code>Browser</code>
            </a>{' '}
            instance by default.
          </React.Fragment>
        }
        name="context"
        optional
        type="Object"
      />
    </React.Fragment>
  );
}

export default ArgumentRepl;
import React from "react"
import { render } from "react-dom"
import { createGlobalStyle } from "styled-components"
import { styles } from "@storybook/design-system"

import Dashboard from "./Dashboard"

const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css?family=Nunito+Sans:400,700,800,900');
  html, body, #app {
    height:100%;
  }
  body {
    background: ${styles.background.app};
    margin: 0;
    font-family: "Nunito Sans", sans-serif;
  }
  * {
    font-family: inherit;
  }
`

const App = () => (
  <>
    <GlobalStyle />
    <Dashboard />
  </>
)

render(<App />, document.getElementById("app"))

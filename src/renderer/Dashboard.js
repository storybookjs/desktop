import { remote } from "electron"
import React from "react"
import styled, { css, keyframes } from "styled-components"
import { styles } from "@storybook/design-system"
import fs from "fs"
import path from "path"
import { homedir } from "os"
import { spawn } from "child_process"
import logo from "../../static/logo.svg"

const move = keyframes`
  0% {
     background-position: 0 0;
  }
  100% {
     background-position: 50px 50px;
  }
`

const writeFile = (filePath, data) =>
  new Promise((resolve, reject) => fs.writeFile(filePath, data, err => (err ? reject(err) : resolve(data))))

const readFile = filePath =>
  new Promise((resolve, reject) => fs.readFile(filePath, "utf-8", (err, data) => (err ? reject(err) : resolve(data))))

const parseJson = data => {
  try {
    return Promise.resolve(JSON.parse(data))
  } catch (e) {
    return Promise.reject(e)
  }
}

const { app, dialog, BrowserWindow } = remote
const homedirRegExp = new RegExp("^" + homedir())
const projectsFilePath = path.join(app.getPath("userData"), "projects.json")

const Grid = styled.div`
  -webkit-app-region: drag;
  display: grid;
  height: 100%;
  grid-template-columns: 1fr;
  grid-template-rows: 38px 1fr auto;
  grid-template-areas: "controls" "projects" "menu";
`

const Menu = styled.div`
  margin: 12px;
  grid-area: menu;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  & > * {
    -webkit-app-region: no-drag;
  }
`

const Projects = styled.ol`
  -webkit-app-region: no-drag;
  grid-area: projects;
  margin: 0 8px;
  padding: 0;
  background: white;
  border-radius: 4px;
  box-shadow: 0 1px 5px 0 rgba(0, 0, 0, 0.1);
  overflow: auto;
`

const Controls = styled.div`
  user-select: none;
  grid-area: controls;
  display: flex;
  justify-content: center;
  align-items: center;
`
const Image = styled.img`
  height: 20px;
`
const Project = styled.li`
  position: relative;
  padding: 12px;
  border-bottom: 1px solid ${styles.color.mediumlight};
  cursor: ${props => (props.isDisabled ? "default" : "pointer")};
  word-wrap: break-word;
  transition: all 0.2s;
  &:hover {
    background: ${props => (props.isDisabled ? "transparent" : styles.color.lighter)};
  }
  &:before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    opacity: 0;
    transition: opacity 0.3s;
    background-image: linear-gradient(
      -45deg,
      rgba(0, 0, 0, 0.05) 25%,
      transparent 25%,
      transparent 50%,
      rgba(0, 0, 0, 0.05) 50%,
      rgba(0, 0, 0, 0.05) 75%,
      transparent 75%,
      transparent
    );
    background-size: 50px 50px;
  }
  ${props =>
    props.isLoading &&
    css`
      background: ${styles.color.lighter}!important;
      &:before {
        opacity: 1;
        animation: ${move} 2s linear infinite;
      }
    `}
`
const Name = styled.strong`
  display: block;
  font-weight: 800;
`
const Location = styled.small`
  display: block;
  color: ${styles.color.mediumdark};
`
const Button = styled.button`
  font-size: 0.75em;
  background: ${styles.color.primary};
  color: white;
  border: 0;
  border-radius: 20px;
  padding: 8px 12px;
  font-weight: bold;
  outline: 0;
  cursor: pointer;
`
const Remove = styled.button`
  position: absolute;
  right: 0;
  top: 0;
  border: 0;
  background: none;
  outline: 0;
`

const getProjectInfo = async path => {
  const file = await readFile(path)
  const { name, scripts } = await parseJson(file)
  if (typeof scripts !== "object") {
    throw new Error("Invalid package.json, expecting a `scripts` object.")
  }
  const location = path.replace(/(\\|\/)package\.json$/i, "").replace(homedirRegExp, "~")
  return { name, path, location }
}

const getStartScript = async path => {
  const file = await readFile(path)
  const { scripts } = await parseJson(file)
  if (typeof scripts !== "object") {
    throw new Error("Invalid package.json, expecting a `scripts` object.")
  }
  const script = Object.keys(scripts).find(key => ~scripts[key].indexOf("start-storybook"))
  return { script, command: scripts[script] }
}

const Dashboard = () => {
  const [loading, setLoading] = React.useState()
  const [projects, setProjects] = React.useState()

  React.useEffect(() => {
    readFile(projectsFilePath)
      .then(parseJson)
      .then(setProjects)
      .catch(() => setProjects([]))
  }, [])

  const addProject = async () => {
    const res = await dialog.showOpenDialog(remote.getCurrentWindow(), {
      properties: ["openFile"],
      filters: [{ name: "package.json", extensions: ["json"] }]
    })
    const filePaths = res ? res.filePaths || res : []
    if (!filePaths[0].endsWith("/package.json")) {
      throw new Error("Expecting a file called `package.json`.")
    }
    const project = await getProjectInfo(filePaths[0])
    if (projects.find(p => p.path === project.path)) return
    const newProjects = [...projects, project]
    setProjects(newProjects)
    writeFile(projectsFilePath, JSON.stringify(newProjects))
  }

  const removeProject = (e, project) => {
    e.stopPropagation()
    const newProjects = projects.filter(p => p.path !== project.path)
    setProjects(newProjects)
    writeFile(projectsFilePath, JSON.stringify(newProjects))
  }

  const openProject = async project => {
    if (loading) return

    setLoading(project.path)
    const { script, command } = await getStartScript(project.path)

    console.log(`Starting 'npm run ${script} -- --ci' (${command})`)
    const cp = spawn(`npm run ${script} -- --ci`, {
      cwd: path.dirname(project.path),
      shell: true
    })
    process.on("close", () => cp.kill())

    // cp.stdout.pipe(process.stdout)
    // cp.stderr.pipe(process.stderr)
    cp.on("error", err => console.error(err))
    cp.on("close", code => code && console.error(`Storybook exited with code: ${code}`))

    let mainWindow = remote.getCurrentWindow()
    cp.stdout.on("data", data => {
      if (new RegExp("Storybook .* started").test(data)) {
        const message = data.toString()
        const [, url] = message.match(/Local:\s+([^\s]+)/)
        console.log(message)
        console.log(`Opening ${url}`)

        let childWindow = new BrowserWindow({
          show: false,
          width: 1280,
          height: 860,
          titleBarStyle: "hidden"
        })
        childWindow.loadURL(url)
        childWindow.once("ready-to-show", () => {
          mainWindow.hide()
          childWindow.show()
          childWindow.focus()
          // childWindow.webContents.openDevTools()
        })
        childWindow.once("closed", () => {
          setLoading(null)
          mainWindow.show()
          mainWindow.focus()
          mainWindow = null
          childWindow = null
          console.log(`Terminating Storybook child process`)
          cp.kill()
        })
      }
    })
  }

  return (
    <Grid>
      <Controls>
        <Image src={logo} />
      </Controls>
      <Menu>
        <Button onClick={addProject} disabled={!projects}>
          Add project
        </Button>
      </Menu>
      <Projects>
        {projects &&
          projects.map(project => (
            <Project key={project.path} onClick={() => openProject(project)} isLoading={loading === project.path}>
              <Name>{project.name}</Name>
              <Location>{project.location}</Location>
              <Remove onClick={e => removeProject(e, project)}>×</Remove>
            </Project>
          ))}
      </Projects>
    </Grid>
  )
}

export default Dashboard

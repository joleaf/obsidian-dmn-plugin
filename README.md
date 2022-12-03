# DMN-Plugin for Obsidian [![GitHub tag (latest by date)](https://img.shields.io/github/v/tag/joleaf/obsidian-dmn-plugin)](https://github.com/joleaf/obsidian-dmn-plugin/releases) [![Release Obsidian Plugin](https://github.com/joleaf/obsidian-dmn-plugin/actions/workflows/release.yml/badge.svg)](https://github.com/joleaf/obsidian-dmn-plugin/actions/workflows/release.yml) ![GitHub all releases](https://img.shields.io/github/downloads/joleaf/obsidian-dmn-plugin/total)

This plugin lets you view DMNs interactively in your [Obsidian](https://www.obsidian.md) notes.
The viewer is based on the [dmn-js](https://github.com/bpmn-io/dmn-js) library.

## Install ..

### .. automatically in Obsidian (not yet)

1. Go to **Community Plugins** in your Obsidian Settings and **disable** Safe Mode
2. Click on **Browse** and search for "DMN Plugin"
3. Click install
4. Toggle the plugin on in the **Community Plugins** tab

### .. manually from this repo

1. Download the latest [release](https://github.com/joleaf/obsidian-dmn-plugin/releases) `*.zip` file.
2. Unpack the zip in the `.obsidan/plugins` folder of your obsidian vault

## How to use

1. Add a valid `*.dmn` file to your vault (e.g., `my-diagram.dmn`) (e.g., modeled with
   the [Camunda Modeler](https://camunda.com/de/download/modeler/))
2. Add the DMN to your note:

````
```dmn
url: [[my-diagram.dmn]]
```
````

### Parameter

You can customize the view with the following parameters:

| Parameter   | Description                                                | Values                                                  |
|-------------|------------------------------------------------------------|---------------------------------------------------------|
| url         | The url of the *.dmn file (required).                      | Relative/Absolute path, or `[[*.dmn]]` as markdown link. |
| decisionId  | An ID of a decision table to open (if empty open the DRD). | String value                                            |
| height      | The height of the rendered canvas.                         | [300..1000]                                             |
| opendiagram | Show a link to the *.dmn file.                             | True/False                                              |
| showzoom    | Show the zoom buttons below the canvas.                    | True/False                                              |
| zoom        | Set the zoom level. Default is 'fit-viewport'.             | 0.0 - 10.0                                              |
| x           | Set the x coordinate, if a zoom value is set.              | 0 - ... (default: 0)                                    |
| y           | Set the y coordinate, if a zoom value is set.              | 0 - ... (default: 0)                                    |

### Example

![Example](example/dmn-plugin.gif)

## How to dev

1. Clone this repo into the plugin folder of a (non-productive) vault (`.obsidian/plugins/`)
2. `npm i`
3. `npm run dev`
4. Toggle the plugin on in the **Community Plugins** tab

## Donate

<a href='https://ko-fi.com/joleaf' target='_blank'><img height='35' style='border:0px;height:46px;' src='https://az743702.vo.msecnd.net/cdn/kofi3.png?v=0' border='0' alt='Buy Me a Coffee at ko-fi.com' />

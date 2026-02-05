import { AcGeCircArc3d } from '@mlightcad/data-model'

import { AcSvgEntity } from './AcSvgEntity'

export class AcSvgCircArc extends AcSvgEntity {
  constructor(arc: AcGeCircArc3d) {
    super()
    if (arc.closed) {
      this.svg = `\n<circle cx="${arc.center.x}" cy="${arc.center.y}" r="${arc.radius}"/>`
    } else {
      const start = arc.startPoint
      const end = arc.endPoint
      const sweepFlag = arc.clockwise ? 0 : 1
      this.svg = `\n<path d="M${start.x},${start.y} A${arc.radius},${arc.radius} 0 ${arc.isLargeArc},${sweepFlag} ${end.x},${end.y}"/>`
    }
    const box = arc.box
    this._box.min.copy(box.min)
    this._box.max.copy(box.max)
  }
}

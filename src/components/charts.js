const svgNode = (tag,attrs={}) => {
  const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,String(value));
  return node;
};

const shortDate = (value) => new Intl.DateTimeFormat('id-ID',{ day:'numeric',month:'short',timeZone:'UTC' }).format(new Date(value));

export function lineChart(series) {
  const width=640,height=260,left=42,right=14,top=16,bottom=36;
  const chartWidth=width-left-right,chartHeight=height-top-bottom;
  const values=series.map((row) => Number(row.downloads) || 0);
  const max=Math.max(1,...values);
  const svg=svgNode('svg',{ class:'chart-svg line-chart',viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':`Grafik aktivitas download. Nilai tertinggi ${max}.` });
  const steps=Math.min(4,max);
  for (let i=0;i<=steps;i++) {
    const y=top+chartHeight*i/steps,value=Math.round(max*(1-i/steps));
    svg.append(svgNode('line',{ x1:left,y1:y,x2:width-right,y2:y,class:'chart-grid' }));
    const label=svgNode('text',{ x:left-8,y:y+4,class:'chart-axis','text-anchor':'end' }); label.textContent=String(value); svg.append(label);
  }
  if (!series.length) return svg;
  const point=(row,index) => ({ x:left+(series.length===1?chartWidth/2:chartWidth*index/(series.length-1)),y:top+chartHeight-(Number(row.downloads)||0)/max*chartHeight });
  const points=series.map(point);
  const line=svgNode('polyline',{ points:points.map(({ x,y }) => `${x},${y}`).join(' '),class:'chart-line' }); svg.append(line);
  points.forEach(({ x,y },index) => {
    const dot=svgNode('circle',{ cx:x,cy:y,r:4,class:'chart-point',tabindex:'0' });
    const title=svgNode('title'); title.textContent=`${shortDate(series[index].day)}: ${values[index]} download`; dot.append(title); svg.append(dot);
  });
  const indexes=[0,Math.floor((series.length-1)/2),series.length-1].filter((value,index,array) => array.indexOf(value)===index);
  for (const index of indexes) { const label=svgNode('text',{ x:points[index].x,y:height-10,class:'chart-axis','text-anchor':index===0?'start':index===series.length-1?'end':'middle' }); label.textContent=shortDate(series[index].day); svg.append(label); }
  return svg;
}

export function barChart(rows) {
  const data=rows.slice(0,5),width=520,rowHeight=48,left=14,right=42,labelWidth=170,height=Math.max(130,data.length*rowHeight+20);
  const chartWidth=width-left-right-labelWidth,max=Math.max(1,...data.map((row) => Number(row.downloads)||0));
  const svg=svgNode('svg',{ class:'chart-svg bar-chart',viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':'Grafik kampanye dengan download terbanyak.' });
  data.forEach((row,index) => {
    const y=12+index*rowHeight,value=Number(row.downloads)||0,barWidth=value/max*chartWidth;
    const title=svgNode('text',{ x:left,y:y+19,class:'chart-label' }); title.textContent=row.title.length>24?`${row.title.slice(0,23)}…`:row.title; svg.append(title);
    const track=svgNode('rect',{ x:left+labelWidth,y,width:chartWidth,height:24,rx:4,class:'chart-bar-track' }); svg.append(track);
    const bar=svgNode('rect',{ x:left+labelWidth,y,width:barWidth,height:24,rx:4,class:'chart-bar',tabindex:'0' });
    const tooltip=svgNode('title'); tooltip.textContent=`${row.title}: ${value} download`; bar.append(tooltip); svg.append(bar);
    const count=svgNode('text',{ x:width-right+8,y:y+17,class:'chart-value' }); count.textContent=String(value); svg.append(count);
  });
  return svg;
}

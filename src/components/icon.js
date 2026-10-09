import { createElement } from 'lucide';

export function icon(definition,size=18) {
  return createElement(definition,{ width:size,height:size,'stroke-width':'1.8','aria-hidden':'true',focusable:'false',class:'icon' });
}

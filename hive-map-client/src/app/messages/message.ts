export class Message {
  id?: string;
  text: string;
  children?: Message[];
  name: string;
  picture?: string;
  timestamp?: string;

  // virtual
  _children?: Message[];
  popularity?: number;
}

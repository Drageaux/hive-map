export class Message {
  id?: string | number;
  text: string;
  children?: Message[];
  name: string;
  picture?: string;
  timestamp?: string;
}

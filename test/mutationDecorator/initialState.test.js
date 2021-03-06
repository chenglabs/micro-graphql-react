import { React, Component, mount, shallow, ClientMock, query, mutation, setDefaultClient, basicQuery } from "../testSuiteInitialize";
import { getPropsFor } from "../testUtils";

let client1;

beforeEach(() => {
  client1 = new ClientMock("endpoint1");
  setDefaultClient(client1);
});

class Dummy extends Component {
  render() {
    return null;
  }
}

const getMutationComponent = () => {
  @mutation(`someMutation{}`)
  class C extends Component {
    render() {
      let props = this.props;
      let { running, finished, runMutation } = props;

      expect(typeof props.runMutation).toBe("function");
      expect(props.running).toBe(false);
      expect(props.finished).toBe(false);

      return <Dummy {...{ running, finished, runMutation }} />;
    }
  }

  return C;
};

test("Everything exists when rendered", () => {
  let Component = getMutationComponent();
  let wrapper = mount(<Component />);
});

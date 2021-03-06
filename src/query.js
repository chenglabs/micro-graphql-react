import React, { Component } from "react";
import { defaultClientManager } from "./client";
import QueryManager from "./queryManager";

export default (query, variablesFn, packet = {}) => BaseComponent => {
  if (typeof variablesFn === "object") {
    packet = variablesFn;
    variablesFn = null;
  }
  const { mapProps = props => props, client: clientOption } = packet;
  let { onMutation } = packet;
  if (typeof onMutation === "object" && !Array.isArray(onMutation)) {
    onMutation = [onMutation];
  }

  const getQueryPacket = props => [query, variablesFn ? variablesFn(props) : null, { onMutation }];

  return class extends Component {
    constructor(props) {
      super(props);
      let client = clientOption || defaultClientManager.getDefaultClient();
      if (!client) {
        throw "[micro-graphql-error]: No client is configured. See the docs for info on how to do this.";
      }

      let setState = queryState => this.setState({ queryState });
      this.queryManager = new QueryManager({ client, setState, cache: packet.cache }, getQueryPacket(this.props));
      this.state = { queryState: this.queryManager.currentState };
    }
    componentDidMount() {
      this.queryManager.load();
    }
    componentDidUpdate(prevProps, prevState) {
      this.queryManager.updateIfNeeded(getQueryPacket(this.props));
    }
    componentWillUnmount() {
      this.queryManager.dispose();
    }
    render() {
      let packet = mapProps({
        ...this.state.queryState
      });

      return <BaseComponent {...packet} {...this.props} />;
    }
  };
};

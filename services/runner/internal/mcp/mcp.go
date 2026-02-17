package mcp

type Client struct{}

func NewClient() *Client {
	return &Client{}
}

func (c *Client) Name() string {
	return "mcp-stub"
}

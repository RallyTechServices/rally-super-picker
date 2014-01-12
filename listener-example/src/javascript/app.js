Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    setting_key: 'rally.techservices.projectselection',

    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',itemId:'message_box',tpl:'Hello, <tpl>{_refObjectName}</tpl>'},
        {xtype:'tsinfolink'}
    ],
    launch: function() {
        this.down('#message_box').update(this.getContext().getUser());
        this.subscribe(this, this.setting_key, this._onSettingUpdate, this);
    },
    _onSettingUpdate: function(selected_projects) {
        this.logger.log("updated",selected_projects);
        var message = [];
        Ext.Array.each(selected_projects,function(project){
            message.push(project.get("Name"));
        });
        this.down('#message_box').update({_refObjectName: message.join(', ')});
    }
});

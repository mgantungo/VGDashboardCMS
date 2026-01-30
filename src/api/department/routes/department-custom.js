'use strict';

module.exports = {
    routes: [
        {
            method: 'GET',
            path: '/department',
            handler: 'department.find',
            config: {
                auth: false,
            },
        },
        {
            method: 'GET',
            path: '/department/:id',
            handler: 'access-log.findOne',
            config: {
                auth: false,
            },
        },
        {
            method: 'POST',
            path: '/department',
            handler:'department.create',
            config: {
                auth: false,
            },
        },
        {
            method: 'PUT',
            path: '/department/:id',
            handler: 'access-log.update',
            config: {
                auth: false,
            },
        },
        {
            method: 'DELETE',
            path: '/department/:id',
            handler: 'deartment.delete',
            config: {
                auth: false,
            },
        },
    ],
};
